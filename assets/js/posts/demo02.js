"use strict";

const width = 512;
const height = 512;

let errorDisplay = document.querySelector("#unrender_error");
let displayErrorMap = false;
let pause = false;
let canvas = document.querySelector("#demo02_canvas");
console.assert(canvas.width == width && canvas.height == height);

let gl = WebGLDebugUtils.makeDebugContext(canvas.getContext('webgl'));

function loadShaderProgram(vertexSrc, fragmentSrc) {
	function loadShader(type, source) {
		let shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) // Error
			console.error(gl.getShaderInfoLog(shader) + '\n\n' + source);
		return shader;
	}

	let vertexShader = loadShader(gl.VERTEX_SHADER, vertexSrc);
	let fragmentShader = loadShader(gl.FRAGMENT_SHADER, fragmentSrc);
	let shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) // Error
		console.error(gl.getProgramInfoLog(shaderProgram));

	return shaderProgram;
}

function loadTexture (path) {
	let texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	
	let temp = new Uint8Array([255, 0, 255, 255]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, temp);
	gl.bindTexture(gl.TEXTURE_2D, null);
	
	let img = new Image();
	img.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.generateMipmap(gl.TEXTURE_2D);
	}

	img.src = path;
	return texture;
}

let errorShaderProgram = null;
let errorAttribXYUV = null;
let errorUniformExperience = null;
let errorUniformHypothesis = null;

let flatShaderProgram = null;
let flatAttribXY = null;
let flatUniformColor = null;

let screenVBO = null; // Full screen triangle
let triangleVBO = null; // Test subject

let testFrameBuffer = null; // Framebuffer for test renders
let testTexture = null; // Texture for reading test renders

let textures = [];
let textureIndex = 0;

let model = {};
let delta = 1/255;

let bgTrainRate = 0.1;
let fgTrainRate = 0.1;
let vertTrainRate = 0.9;

function switchModel(index) {
	textureIndex = index;
	model = {
		backgroundColor: [0.25, 0.25, 0.25],
		forgroundColor: [0.75, 0.75, 0.75],
		vertices: [
				-0.5, -0.5,
				 0.5, -0.5,
				 0.0, 0.5
		]
	};
};
switchModel(0);

function init() {
	// Vertex Buffers
	screenVBO = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, screenVBO);
	let data = new Float32Array([
		-1.0, -1.0, 0.0, 1.0,
		-1.0, 3.0, 0.0, -1.0,
		3.0, -1.0, 2.0, 1.0
	]);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	triangleVBO = gl.createBuffer(); 

	// Shaders
	errorShaderProgram = loadShaderProgram(
		`// Vertex Shader
		attribute vec4 a_xyuv;
		varying highp vec2 v_texture_coord;
		void main() {
			v_texture_coord = a_xyuv.zw;
			gl_Position = vec4(a_xyuv.xy, 0.0, 1.0);
		}`,
		`// Fragment Shader
		precision highp float;
		varying highp vec2 v_texture_coord;
		uniform sampler2D u_hypothesis;
		uniform sampler2D u_experience;
		void main() {
			vec4 experience = texture2D(u_experience, v_texture_coord);
			vec2 hypothesis_coords = vec2(v_texture_coord.x, 1.0 - v_texture_coord.y);
			vec4 hypothesis = texture2D(u_hypothesis, hypothesis_coords);
			vec4 e = experience - hypothesis;
			gl_FragColor = vec4(e.x*e.x, e.y*e.y, e.z*e.z, 1.0);
		}`);

	errorAttribXYUV = gl.getAttribLocation(errorShaderProgram, 'a_xyuv');
	errorUniformHypothesis = gl.getUniformLocation(errorShaderProgram, 'u_hypothesis');
	errorUniformExperience = gl.getUniformLocation(errorShaderProgram, 'u_experience');

	flatShaderProgram = loadShaderProgram(
		`// Vertex Shader
		attribute vec2 a_xy;
		void main() {
			gl_Position = vec4(a_xy, 0.0, 1.0);
		}`,
		`// Fragment Shader
		precision mediump float;
		uniform vec3 u_color;
		void main() {
			gl_FragColor = vec4(u_color, 1.0);
		}`);

	flatAttribXY = gl.getAttribLocation(flatShaderProgram, 'a_xy');
	flatUniformColor = gl.getUniformLocation(flatShaderProgram, 'u_color');

	// Frame buffer & texture
	testTexture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, testTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	let testDepthBuffer = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, testDepthBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

	testFrameBuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, testFrameBuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, testTexture, 0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, testDepthBuffer);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);

	// Example Textures
	textures.push(loadTexture("/assets/img/unrender01.jpg"));
	textures.push(loadTexture("/assets/img/unrender02.jpg"));
	textures.push(loadTexture("/assets/img/unrender03.jpg"));
	textures.push(loadTexture("/assets/img/unrender04.jpg"));

	requestAnimationFrame(draw);
}

function drawModel() {
	gl.viewport(0, 0, width, height);
	gl.clearColor(
		model.backgroundColor[0],
		model.backgroundColor[1],
		model.backgroundColor[2],
		1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Draw test triangle
	gl.useProgram(flatShaderProgram);
	gl.bindBuffer(gl.ARRAY_BUFFER, triangleVBO);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.vertices), gl.DYNAMIC_DRAW);
	gl.vertexAttribPointer(flatAttribXY, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(flatAttribXY);
	gl.uniform3fv(flatUniformColor, model.forgroundColor);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function drawError() {
	gl.bindFramebuffer(gl.FRAMEBUFFER, testFrameBuffer);
	drawModel();

	// Draw Error map
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	gl.viewport(0, 0, width, height);
	gl.clearColor(0.0, 1.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.useProgram(errorShaderProgram);
	gl.bindBuffer(gl.ARRAY_BUFFER, screenVBO);
	gl.vertexAttribPointer(errorAttribXYUV, 4, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(errorAttribXYUV);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures[textureIndex]);
	gl.uniform1i(errorUniformExperience, 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, testTexture);
	gl.uniform1i(errorUniformHypothesis, 1);

	gl.drawArrays(gl.TRIANGLES, 0, 3);
	gl.bindTexture(gl.TEXTURE_2D, null);
}

function getError() {
	drawError();

	

	// Read error map
	let pixels = new Uint8Array(width * height * 4);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
	let error = pixels.reduce((a, b) => (a + (b/255.0)))/(width * height * 3);
	return error;
}

function draw() {
	let oldModel = model;
	let oldError = getError();

	if (!pause) {
		// Train background Color
		for (let i = 0; i < 3; i++) {
			let error0 = getError();
			let oldValue = model.backgroundColor[i];
			model.backgroundColor[i] += delta;
			let newValue = model.backgroundColor[i];
			let error1 = getError();

			model.backgroundColor[i] = oldValue - bgTrainRate * (error1 - error0)/delta;
		}

		// Train Forground Color
		for (let i = 0; i < 3; i++) {
			let error0 = getError();
			let oldValue = model.forgroundColor[i];
			model.forgroundColor[i] += delta;
			let error1 = getError();

			model.forgroundColor[i] = oldValue - fgTrainRate * (error1 - error0)/delta;
		}

		// Train Vertices
		for (let i = 0; i < model.vertices.length; i++) {
			let error0 = getError();
			let oldValue = model.vertices[i];
			model.vertices[i] += delta;
			let newValue = model.vertices[i];
			let error1 = getError();

			model.vertices[i] = oldValue - vertTrainRate * (error1 - error0)/delta;
		}
	}

	let error = getError();
	errorDisplay.innerHTML = "Error: " + error;

	if (!displayErrorMap)
		drawModel();

	requestAnimationFrame(draw);
} 
window.onload = init;

// Control Stuff
let bgTrainControl = document.querySelector("#bg_train");
bgTrainControl.oninput = () => bgTrainRate = bgTrainControl.value/100.0;
let fgTrainControl = document.querySelector("#fg_train");
fgTrainControl.oninput = () => fgTrainRate = fgTrainControl.value/100.0;
let vertTrainControl = document.querySelector("#vert_train");
vertTrainControl.oninput = () => vertTrainRate = vertTrainControl.value/100.0;
let errorMapControl = document.querySelector("#unrender_display_error");
errorMapControl.oninput = () => displayErrorMap = !displayErrorMap;
let pauseControl = document.querySelector("#unrender_pause");
pauseControl.oninput = () => pause = !pause;
