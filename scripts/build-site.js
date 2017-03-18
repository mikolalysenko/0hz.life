var path = require('path')
var fs = require('fs')
var buildPost = require('./build-post')
var posts = require('../posts.json')

var browserify = require('browserify')

var POST_DIR = path.join(__dirname, '../posts')
var BUILD_DIR = path.join(__dirname, '../build')
var STYLE_DIR = path.join(__dirname, '../style')

var CSS = [
  'main.css',
  'jura.woff2'
]

var postData = new Array(posts.length)
var pendingPosts = posts.length

CSS.forEach(function (cssFile) {
  fs.link(path.join(STYLE_DIR, cssFile), path.join(BUILD_DIR, cssFile), function (err) { })
})

browserify(path.join(__dirname, '../visual/gfx.js'), {
  transform: [ 'es2020' ]
}).bundle(function (err, data) {
  if (err) {
    return console.error(err)
  }
  fs.writeFile(path.join(BUILD_DIR, 'main-gfx.js'), data)
})

posts.forEach(function (postFile, i) {
  buildPost(
    path.join(POST_DIR, postFile),
    path.join(BUILD_DIR, postFile),
    function (err, desc) {
      if (err) {
        return console.error(err)
      }
      postData[i] = {
        relPath: postFile,
        dir: path.join(BUILD_DIR, postFile),
        desc: desc
      }
      if (--pendingPosts <= 0) {
        return buildSite()
      }
    })
})

function buildSite () {
  var siteContent = postData.map(function (post) {
    var dir = post.dir
    var desc = post.desc
    var reldir = path.relative(BUILD_DIR, dir)
    var url = post.url || (reldir + '/index.html')
    return `
    <a href="${url}" class="postLink" style="background:url(${reldir}/${desc.image});background-size: 100%;">
      <div class="postCaption">
        <h2 class="postTitle">${desc.title}</h2>
        <p class="postAbstract">${desc.abstract}</p>
      </div>
    </a>`
  })

  var site = `
<!DOCTYPE html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width">
  <link href="main.css" rel="stylesheet" type="text/css">
  <title>0Hz.life</title>
</head>
<body>
<canvas class="mainCanvas"></canvas>
<div class="header">
  <h1 class="titleBlock">0Hz.LIFE</h1>
  <div class="titleGraphic">
    <h2>mikola's sketch book</h2>
  </div>
  <nav class="navHeader">
    <a href="index.html">Posts</a>
    <a href="https://0fps.net">Old</a>
    <a href="https://bits.coop">BITS</a>
    <a href="https://twitter.com/mikolalysenko">Twitter</a>
    <a href="https://github.com/mikolalysenko">GitHub</a>
  </nav>
</div>
<div class="postContainer">
  ${siteContent.join('\n')}
</div>
<div class="footer">
(c) 2017- <a href="mailto:mikolalysenko@gmail.com">Mikola Lysenko</a>
</div>
<script src="main-gfx.js" type="text/javascript"></script
</body>`

  fs.writeFile(path.join(BUILD_DIR, 'index.html'), site)
}
