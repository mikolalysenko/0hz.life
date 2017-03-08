var drmark = require('drmark')
var path = require('path')
var fs = require('fs')
var mkdirp = require('mkdirp')
var glob = require('glob')

function buildPage (dir, target, cb) {
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
      return generateBlog(dir, blogDesc, function (err, page) {
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

function generateBlog (dir, desc, cb) {
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
</head>
<body>
${html}
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
