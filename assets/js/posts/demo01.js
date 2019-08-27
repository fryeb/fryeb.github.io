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
let shaderProgram = null;
let positionAttributeLocation = null;
let colorUniformLocation = null;
function init() {
	// Vertex Buffer
	vertexBuffer = gl.createBuffer();

	// Shader Program
	const vertexSource = `
		uniform vec3 u_color;
		attribute vec2 a_position;
		varying highp vec4 v_color;

		void main() {
			v_color = vec4(u_color, 1.0);
			gl_Position = vec4(a_position, 0.0, 1.0);
		}
	`;

	const fragSource = `
		varying highp vec4 v_color;

		void main() {
			gl_FragColor = v_color;
		}
	`;

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

	const vertexShader = loadShader(gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fragSource);

	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	// Check for link errors
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		console.error(
			'Shader program link error: ',
			+ gl.getProgramInfoLog(shaderProgram));
	}
	
	positionAttributeLocation = gl.getAttribLocation(shaderProgram, 'a_position');
	colorUniformLocation = gl.getUniformLocation(shaderProgram, 'u_color');

	requestAnimationFrame(draw);
}

function draw () {
	gl.clearColor(
		model.backgroundColor[0],
		model.backgroundColor[1],
		model.backgroundColor[2],
		1.0);

	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.useProgram(shaderProgram);

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	let data = new Float32Array(model.vertices);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

	// Vertex Attrib Pointers
	gl.vertexAttribPointer(
		positionAttributeLocation,
		2, // Components
		gl.FLOAT,
		false, // Don't normalize
		0, 0); // No stride, no offset
	gl.enableVertexAttribArray(positionAttributeLocation);
	gl.uniform3fv(colorUniformLocation, model.forgroundColor);

	gl.drawArrays(gl.TRIANGLES, 0, 3);

	requestAnimationFrame(draw);
}

window.onload = init;
