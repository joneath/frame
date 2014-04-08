module.exports = function (grunt) {
  // show elapsed time at the end
  require('time-grunt')(grunt);
  // load all grunt tasks
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: [
        'Gruntfile.js',
        'src/{,*/}*.js',
        'test/spec/{,*/}*.js'
      ]
    },
    browserify: {
      dist: {
        files: {
          'frame.js': ['src/frame.js']
        }
      }
    },
    uglify: {
      build: {
        files: {
          'frame.min.js': ['frame.js']
        }
      }
    }
  });

  grunt.registerTask('build', [
    'browserify',
    'uglify'
  ]);

  grunt.registerTask('default', ['build']);
};
