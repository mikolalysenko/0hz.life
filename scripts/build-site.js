var path = require('path')
var fs = require('fs')
var buildPost = require('./build-post')
var posts = require('../posts.json')

var POST_DIR = path.join(__dirname, '../posts')
var BUILD_DIR = path.join(__dirname, '../build')

var postData = new Array(posts.length)
var pendingPosts = posts.length

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
    return `
    <a href="${post.relPath}" class="postLink">
      <div class="postCaption">
        <h3>${desc.title}</h3>
        <p>${desc.abstract}</p>
      </div>
      <img src="${dir}/${desc.image}" alt="${desc.title}" class="postImage" />
    </a>`
  })

  var site = `
<!DOCTYPE html>
<head>
<meta charset="utf-8" />
<title>0fps.net</title>
</head>
<body>
<h1>
</h1>
<div class="navHeader">
<a href="index.html">Posts</a>
<a href="about.html">About</a>
</div>
<div class="postContainer">
${siteContent.join('\n')}
</div>
</body>`

  fs.writeFile(path.join(BUILD_DIR, 'index.html'), site)
}
