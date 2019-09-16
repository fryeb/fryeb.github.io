---
layout: default
title: "Unrenderer"
---
<div class="unrenderer">
<canvas id="demo02_canvas" width="512px" height="512px">
</canvas>
<div class="unrender_image_container">
	<img src="/assets/img/unrender01.jpg" alt="test01" onclick="switchModel(0)"/>
	<img src="/assets/img/unrender02.jpg" alt="test01" onclick="switchModel(1)"/>
	<img src="/assets/img/unrender03.jpg" alt="test01" onclick="switchModel(2)"/>
	<img src="/assets/img/unrender04.jpg" alt="test01" onclick="switchModel(3)"/>
</div>
<div class="unrender_control_continer">
	<span id="unrender_error"> Error: </span><br>
	<label for="unrender_display_error"> Display Error Map </label>
	<input type="checkbox" id="unrender_display_error" value="true">
	<br>
	<label for="unrender_pause"> Pause </label>
	<input type="checkbox" id="unrender_pause" value="true">
	<br>
	<label for="delta"> Delta </label>
	<input type="range" min="1" max="511" value="2" class="slider" id="delta">
	<br>
	<label for="bg_train"> Background Training Rate </label>
	<input type="range" min="1" max="200" value="10" class="slider" id="bg_train">
	<br>
	<label for="fg_train"> Forground Training Rate </label>
	<input type="range" min="1" max="200" value="10" class="slider" id="fg_train">
	<br>
	<label for="vert_rain"> Vertex Training Rate </label>
	<input type="range" min="1" max="200" value="90" class="slider" id="vert_train">
	<br>
</div>
</div>
<script src="/assets/js/webgl-debug.js"></script>
<script src="/assets/js/posts/demo02.js"></script>

# Unrenderer
Over the past few weeks I have been exploring a new technique for training triangle
meshes from 3D models. The basic idea is to render a test image, evaluate it by
computing the mean squared error between the test image and a reference, and then
apply gradient descent in order to minimise the error.

## A simple model
For the above demonstration I have used a simple model, with a single triangle, a foreground color,
and a background color.
```js
let model = {
	backgroundColor: [0.25, 0.25, 0.25],
	forgroundColor: [0.75, 0.75, 0.75],
	vertices: [
		-0.5, -0.5,
		0.5, -0.5,
		0.0, 0.5
	]
};
```
Rendering this base model we get the following:
<img src="/assets/img/posts/unrender01/screenshot_untrained.png"
	alt="screenshot of untrained model" class="unrender_screenshot"/>
In order to compute the error of a model, we render the test image into a texture 
and then compare it with the reference image in a shader:
```glsl
// Fragment Shader
precision highp float;
varying highp vec2 v_texture_coord;
uniform sampler2D u_hypothesis;
uniform sampler2D u_experience;
void main() {
	vec4 experience = texture2D(u_experience, v_texture_coord);
	// WebGL inverts the framebuffer so we compensate in the shader
	vec2 hypothesis_coords = vec2(v_texture_coord.x, 1.0 - v_texture_coord.y);
	vec4 hypothesis = texture2D(u_hypothesis, hypothesis_coords);
	vec4 e = experience - hypothesis;
	gl_FragColor = vec4(e.x*e.x, e.y*e.y, e.z*e.z, 1.0);
}
```
Here `experience` refers to the test image, and `hypothesis` refers to the model. 
This will yeild an error map:
<img src="/assets/img/posts/unrender01/screenshot_error.png"
	alt="screenshot of untrained model" class="unrender_screenshot"/>
We then copy the pixel values out of WebGL using `gl.readPixels` and compute
mean squared error in javascript:
```
let error = pixels.reduce((a, b) => (a + (b/255.0)))/(width * height * 3);
```
Our goal then is to tweak the properties of the model (forground colour,
background colour and vertex positions), in order to minimise the error calculated above.
We do this using gradient descent, the basic idea behind gradient descent is to train
one attribute at a time, by taking the derivative of the cost function, multiplying 
it by a `trainingRate` and then subtracting that from the original value:
```
newValue = oldValue - trainingRate * derivative(oldValue)
```
Often in machine learning we would solve this analytically with partial derivatives,
but since the cost function involves rendering the model this isn't really feasable,
so to approximate the derivative we can just render the model twice adding a small delta
value in between. Assuming a small delta, this should give us a decent aproximation of
the derivative. The new formula is as follows:
```
newValue = oldValue - trainingRate * (newError - oldError)/delta
```
If we apply this to each vertex coordinate and each component of the foreground and 
background colours, then after several iterations we should see the model converge
to something like this:
<img src="/assets/img/posts/unrender01/screenshot_result.png"
	alt="screenshot of untrained model" class="unrender_screenshot"/>
