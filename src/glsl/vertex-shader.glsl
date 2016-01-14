attribute vec2 vertex;
uniform vec2 center, scaleRatio;
uniform float pointSize;

void main() {
  gl_Position = vec4((vertex - center) * scaleRatio, 0, 1);
  gl_PointSize = pointSize;
}
