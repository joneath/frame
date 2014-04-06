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
    uglify: {
      build: {
        files: {
          'dist/frame.min.js': ['src/frame.js']
        }
      }
    }
  });

  grunt.registerTask('build', [
    'uglify'
  ]);

  grunt.registerTask('default', ['build']);
};
