var fs = require('fs')
var path = require('path')
var glob = require('glob')
var NeoCities = require('neocities')
var credentials = require('../credentials.json')
var api = new NeoCities(credentials.username, credentials.password)

var BUILD_DIR = path.join(__dirname, '../build')

glob(BUILD_DIR + '/**', function (err, files) {
  if (err) {
    return console.error(err)
  }

  var output = []
  files.forEach(function (file) {
    var rel = path.relative(BUILD_DIR, file)
    if (!rel) {
      return
    }
    var stats = fs.lstatSync(file)
    if (!stats.isDirectory()) {
      output.push({
        name: rel, path: file
      })
    }
  })
  api.upload(output, function (resp) {
    console.log(resp)
  })
})
