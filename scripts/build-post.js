var drmark = require('drmark')
var path = require('path')
var fs = require('fs')
var mkdirp = require('mkdirp')
var glob = require('glob')

function buildPage (dir, target, nextLink, prevLink, cb) {
  fs.readFile(path.join(dir, 'blog.json'), { encoding: 'utf-8' }, function (err, blogDescStr) {
    if (err) {
      return cb(err)
    }
    var blogDesc
    try {
      blogDesc = JSON.parse(blogDescStr)
    } catch (parseErr) {
      return cb(err)
    }
    mkdirp(target, function (err) {
      if (err) {
        return cb(err)
      }
      var assets = blogDesc.assets.concat([blogDesc.image])
      var failed = false
      var pending = assets.length + 1
      for (var i = 0; i < assets.length; ++i) {
        copyAsset(assets[i], dir, target, next)
      }
      return generateBlog(dir, blogDesc, nextLink, prevLink, function (err, page) {
        if (err) {
          return cb(err)
        }
        fs.writeFile(path.join(target, 'index.html'), page, next)
      })
      function next (err) {
        if (failed) {
          return
        }
        if (err) {
          failed = true
          return cb(err)
        }
        if (--pending <= 0) {
          return cb(null, blogDesc)
        }
      }
    })
  })
}

function generateBlog (dir, desc, nextLink, prevLink, cb) {
  var title = desc.title
  var page = desc.page
  fs.readFile(path.join(dir, page), {encoding: 'utf-8'}, function (err, data) {
    if (err) {
      return cb(err)
    }

    drmark(data, {
      transform: [
        'multi-regl-transform'
      ]
    }, function (err, html) {
      if (err) {
        return cb(err)
      }
      cb(null, `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link href="../post.css" rel="stylesheet" type="text/css">
</head>
<body>
<div class="header">
<h1 class="titleBlock">${desc.title}</h1>
<div class="titleGraphic"><h2>mikola's sketch book</h2></div>
<nav class="navHeader">
  ${prevLink ? `<a href="${prevLink}">&lt; Prev</a>` : ''}
  <a href="../index.html">Posts</a>
  <a href="https://0fps.net">Old</a>
  <a href="https://bits.coop">BITS</a>
  <a href="https://twitter.com/mikolalysenko">Twitter</a>
  <a href="https://github.com/mikolalysenko">GitHub</a>
  ${nextLink ? `<a href="${nextLink}">Next &gt;</a>` : ''}
</nav>
</div>
<div class="content">
${html}
</div>
<div class="footer">
  <nav class="navFooter">
    ${prevLink ? `<a href="${prevLink}">&lt; Prev</a>` : ''}
    <a href="../index.html">Home</a>
    ${nextLink ? `<a href="${nextLink}">Next &gt;</a>` : ''}
  </nav>
  <div>(c) 2017- <a href="mailto:mikolalysenko@gmail.com">Mikola Lysenko</a></div>
</div>
</body>
</html>`)
    })
  })
}

function copyAsset (pattern, dir, target, cb) {
  glob(path.join(dir, pattern), function (err, matches) {
    if (err) {
      return cb(err)
    }
    matches.forEach(function (filename) {
      fs.link(filename, path.join(target, path.relative(dir, filename)), next)
      var failed = false
      var pending = matches.length
      function next (err) {
        if (failed) {
          return
        }
        if (err && err.code !== 'EEXIST') {
          failed = true
          return cb(err)
        }
        if (--pending <= 0) {
          return cb(null)
        }
      }
    })
  })
}

module.exports = buildPage
