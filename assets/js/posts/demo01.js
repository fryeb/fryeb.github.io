const canvas = document.querySelector("#demo01_canvas");
const gl = canvas.getContext('webgl');

let model = {
	backgroundColor: [0.25, 0.25, 0.25],
	forgroundColor: [0.75, 0.75, 0.75],
	vertices: [
		-0.5, -0.5,
		0.5, -0.5,
		0.0, 0.5
	]
};

let vertexBuffer = null;
let testProgram = null; // Shader program for rendering test images
let evaluationProgram = null; // Shader program for rendering evaluating images
let testColorUniformLocation = null;
let testPositionAttributeLocation = null;
let evaluationPositionAttributeLocation = null;
let evaluationSamplerUniformLocation = null;
let textures = [];
let textureIndex = 0; // Which texture are we training to?

function loadShaderProgram(vertSrc, fragSrc) {
	function loadShader(type, source) {
  		const shader = gl.createShader(type);

  		gl.shaderSource(shader, source);
  		gl.compileShader(shader);

  		// Check for build errors
  		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    			console.error(
				'Shader compilation error:'
				 + gl.getShaderInfoLog(shader) + '\n'
				 + source);
    			gl.deleteShader(shader);
    			return null;
  		}

  		return shader;
	}	

	const vertexShader = loadShader(gl.VERTEX_SHADER, vertSrc);
	const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fragSrc);

	const shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	// Check for link errors
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		console.error(
			'Shader program link error: ',
			+ gl.getProgramInfoLog(shaderProgram));
	}
	
	return shaderProgram;
}

function init() {
	// Vertex Buffer
	vertexBuffer = gl.createBuffer();

	// Shader Programs
	testProgram = loadShaderProgram(
		// Vertex Shader
		`uniform vec3 u_color;
		attribute vec2 a_position;
		varying highp vec4 v_color;

		void main() {
			v_color = vec4(u_color, 1.0);
			gl_Position = vec4(a_position, 0.0, 1.0);
		}`,
		// Fragment Shader
		`varying highp vec4 v_color;

		void main() {
			gl_FragColor = v_color;
		}
	`);

	evaluationProgram = loadShaderProgram(
		// Vertex Shader
		`attribute vec4 a_position;
		varying highp vec2 v_texture_coord;
		void main() {
			v_texture_coord = a_position.zw;
			gl_Position = vec4(a_position.xy, 0.0, 1.0);
		}`,
		// Fragment Shader
		`varying highp vec2 v_texture_coord;
		uniform sampler2D u_sampler;

		void main(void) {
			gl_FragColor = texture2D(u_sampler, v_texture_coord);
			// gl_FragColor = vec4(0.0, vTextureCoord.x, vTextureCoord.y, 1.0);
		}`
	);	
	testPositionAttributeLocation = gl.getAttribLocation(testProgram, 'a_position');
	testColorUniformLocation = gl.getUniformLocation(testProgram, 'u_color');
	evaluationPositionAttributeLocation = gl.getAttribLocation(evaluationProgram, 'a_position');
	evaluationSamplerUniformLocation = gl.getUniformLocation(evaluationProgram, 'u_sampler');

	function loadTexture(path) {
		let texture = gl.createTexture();

		// Temp texure while main texture loads
		gl.bindTexture(gl.TEXTURE_2D, texture);
		let tempPixel = new Uint8Array([255, 0, 255, 255]); // Magenta
		gl.texImage2D(
			gl.TEXTURE_2D,
			0, // level
			gl.RGBA, // Internal format
			1, 1, 0, // width, height, border
			gl.RGBA, // src format
			gl.UNSIGNED_BYTE, // src type
			tempPixel);
		gl.bindTexture(gl.TEXTURE_2D, null);

		let img = new Image();
		img.onload = function() {
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(
				gl.TEXTURE_2D, 
				0, // level
				gl.RGBA, // internal format
				gl.RGBA, // src format
				gl.UNSIGNED_BYTE, // src type
				img);

			gl.generateMipmap(gl.TEXTURE_2D);
		};

		img.src = path;
		return texture;
	}

	textures.push(loadTexture("/assets/img/unrender01.jpg"));
	textures.push(loadTexture("/assets/img/unrender02.jpg"));
	textures.push(loadTexture("/assets/img/unrender03.jpg"));
	textures.push(loadTexture("/assets/img/unrender04.jpg"));

	requestAnimationFrame(draw);
}

function drawTest() {
	gl.useProgram(testProgram);

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	let data = new Float32Array(model.vertices);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

	// Vertex Attrib Pointers
	gl.vertexAttribPointer(
		testPositionAttributeLocation,
		2, // Components
		gl.FLOAT,
		false, // Don't normalize
		0, 0); // No stride, no offset
	gl.enableVertexAttribArray(testPositionAttributeLocation);
	gl.uniform3fv(testColorUniformLocation, model.forgroundColor);

	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function drawEvaluation() {
	gl.useProgram(evaluationProgram);

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	// Full screen triangle
	let data = new Float32Array([
		-1.0, -1.0, 0.0, 2.0, 
		-1.0, 3.0, 0.0, 0.0,
		3.0, -1.0, 2.0, 2.0
	]);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

	// Vertex Attrib Pointers
	gl.vertexAttribPointer(
		evaluationPositionAttributeLocation,
		4, // Components
		gl.FLOAT,
		false, // Don't normalize
		0, 0); // stride, offset
	gl.enableVertexAttribArray(evaluationPositionAttributeLocation);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures[textureIndex]);
	gl.uniform1i(evaluationSamplerUniformLocation, 0); // Tell shader to use texture 0

	gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function draw () {
	gl.clearColor(
		model.backgroundColor[0],
		model.backgroundColor[1],
		model.backgroundColor[2],
		1.0);

	gl.clear(gl.COLOR_BUFFER_BIT);

	//drawTest();
	drawEvaluation();

	requestAnimationFrame(draw);
}

window.onload = init;
