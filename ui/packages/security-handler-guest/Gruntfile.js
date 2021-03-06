/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either
 * version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Lesser General Public License for more details. A copy of the GNU Lesser General Public License is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/
/*global module,require*/

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt, { requireResolution: true })

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    ports: {
      express: 0,
    },

    clean: {
      build: ['target/webapp'],
    },
    cssmin: {
      compress: {
        files: {
          'target/webapp/css/index.css': ['src/main/webapp/css/*.css'],
        },
      },
    },
    watch: {
      livereload: {
        options: { livereload: true },
        files: ['target/webapp/css/index.css'],
      },
      cssFiles: {
        files: ['src/main/webapp/css/*.css'],
        tasks: ['cssmin'],
      },
    },
    express: {
      options: {
        port: 8282,
        hostname: '*',
      },
      test: {
        options: {
          port: '<%= ports.express %>',
          script: './test.js',
        },
      },
      server: {
        options: {
          script: './server.js',
        },
      },
    },
  })

  var buildTasks = ['clean', 'cssmin']

  grunt.registerTask('build', buildTasks)
  grunt.registerTask('default', ['build', 'express:server', 'watch'])
}
