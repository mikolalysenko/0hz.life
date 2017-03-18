const regl = require('regl')({
  canvas: document.querySelector('canvas')
})

const perspective = require('gl-mat4/perspective')
const lookAt = require('gl-mat4/lookAt')
const ndarray = require('ndarray')
const surfaceNets = require('surface-nets')

const NX = 68
const NY = 68
const NZ = 64
const X0 = -NX / 2
const Z0 = -NZ / 2
const DT = 1e-4
const K = 0.125

const CLIMB_SPEED = 0.05
const SPIN_RATE = 0.005

const chunkPool = []
const activeChunks = []

function Chunk (positionBuffer, normalBuffer, elements) {
  this.positionBuffer = positionBuffer
  this.normalBuffer = normalBuffer
  this.elements = elements
  this.offset = [0, 0, 0]
}

const data = new Float32Array(NX * NY * NZ * 18)
const ndfield = ndarray(data, [NX, NY, NZ])

function evalField (ox, oy, oz) {
  var ptr = 0
  for (var i = 0; i < NX; ++i) {
    for (var j = 0; j < NY; ++j) {
      for (var k = 0; k < NZ; ++k) {
        data[ptr++] = field(ox + i, oy + j, oz + k)
      }
    }
  }
}

function evalGradient (ox, oy, oz, points) {
  var ptr = 0
  for (var i = 0; i < points.length; ++i) {
    var p = points[i]
    var x = p[0] + ox
    var y = p[1] + oy
    var z = p[2] + oz
    var dx = field(x + DT, y, z) - field(x - DT, y, z)
    var dy = field(x, y + DT, z) - field(x, y - DT, z)
    var dz = field(x, y, z + DT) - field(x, y, z - DT)
    var l2 = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2))
    data[ptr++] = dx / l2
    data[ptr++] = dy / l2
    data[ptr++] = dz / l2
  }
  return data.subarray(0, ptr)
}

function createChunk (ox, oy, oz) {
  evalField(ox, oy, oz)
  const mesh = surfaceNets(ndfield)
  if (mesh.cells.length <= 0) {
    return
  }

  var c = chunkPool.pop()
  if (!c) {
    c = new Chunk(regl.buffer({
      type: 'float',
      length: 65536 * 6
    }),
    regl.buffer({
      type: 'float',
      length: 65536 * 6
    }),
    regl.elements({
      type: 'uint16',
      length: NX * NY * NZ * 6
    }))
  }
  c.offset[0] = ox
  c.offset[1] = oy
  c.offset[2] = oz

  c.positionBuffer(mesh.positions)
  c.normalBuffer(evalGradient(ox, oy, oz, mesh.positions))
  c.elements(mesh.cells)

  activeChunks.push(c)
}

const projectionMatrix = new Float32Array(16)
const viewMatrix = new Float32Array(16)

function cameraY (tick) {
  return CLIMB_SPEED * tick
}

const drawChunks = regl({
  vert: `
  precision mediump float;
  attribute vec3 position, normal;
  uniform mat4 view, projection;
  uniform vec3 offset;
  varying vec3 v_position, v_normal;
  void main () {
    vec3 p = position + offset;
    v_position = p;
    v_normal = normalize((view * vec4(normal, 0)).xyz);
    gl_Position = projection * view * vec4(p, 1);
  }`,

  frag: `
  precision mediump float;
  varying vec3 v_position, v_normal;
  void main () {
    gl_FragColor = vec4(length(v_normal.xy) * vec3(1,1,1), 1);
  }`,

  uniforms: {
    projection: ({viewportWidth, viewportHeight}) =>
      perspective(projectionMatrix,
        Math.PI / 4.0,
        viewportWidth / viewportHeight,
        0.01,
        1000.0),
    view: ({tick}) =>
      lookAt(viewMatrix,
        [100 * Math.cos(SPIN_RATE* tick), cameraY(tick), 100 * Math.sin(SPIN_RATE * tick)],
        [0, cameraY(tick) - 30, 0],
        [0, 1, 0]),
    offset: regl.prop('offset')
  },

  attributes: {
    position: regl.prop('positionBuffer'),
    normal: regl.prop('normalBuffer')
  },

  elements: regl.prop('elements'),
  // primitive: 'lines',
  offset: 0
})

function updateChunks (tick) {
  var y = cameraY(tick)
  var maxY = -256
  for (var i = activeChunks.length - 1; i >= 0; --i) {
    var chunk = activeChunks[i]
    if (chunk.offset[1] < y - 256) {
      chunkPool.push(chunk)
      activeChunks[i] = activeChunks[activeChunks.length - 1]
      activeChunks.pop()
    }
    maxY = Math.max(maxY, chunk.offset[1])
  }
  while (maxY < y + 256) {
    maxY += NY - 2
    createChunk(X0, maxY, Z0)
  }
}

var canvas = document.querySelector('canvas')

regl.frame(({tick}) => {
  var rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  regl.clear({
    color: [0, 0, 0, 0],
    depth: 1
  })

  updateChunks(tick)
  drawChunks(activeChunks)
})

function distance2 (x, y, a, b) {
  return Math.sqrt(Math.pow(x - a, 2) + Math.pow(y - b, 2))
}

function smin (a, b, c) {
  var x = Math.exp(-K * a) + Math.exp(-K * b) + Math.exp(-K * c)
  return -Math.log(x) / K
}

function field (x, y, z) {
  var ax = 10 * Math.cos(0.1 * y)
  var ay = 10 * Math.sin(0.1 * y)

  var bx = 10 * Math.cos(0.1 * y + 2 + 0.3 * Math.sin(0.25 * y))
  var by = 10 * Math.sin(0.1 * y + 2 + 0.1 * Math.sin(0.25 * y))

  var cx = 25 * Math.cos(0.01 * y + 4)
  var cy = 25 * Math.sin(0.01 * y + 4)

  return smin(
    distance2(x, z, ax, ay) - (7 + 3 * Math.cos(y * 0.05)),
    distance2(x, z, bx, by) - (5 + 3 * Math.cos(y * 0.01)),
    distance2(x, z, cx, cy) - (3 + 1.5 * Math.cos(y * 0.2)))
}
