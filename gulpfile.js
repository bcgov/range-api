//
// SecureImage
//
// Copyright © 2018 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Jason Leach on 2018-01-10.
//

/* eslint-env es6 */

'use strict';

const gulp = require('gulp');
const babel = require('gulp-babel');
const clean = require('gulp-clean');
const sourcemaps = require('gulp-sourcemaps');

gulp.task('clean', () => gulp.src('build', { read: false, allowEmpty: true })
  .pipe(clean({
    force: true,
  })));

gulp.task('transpile', () => gulp.src('src/**/*.js')
  .pipe(sourcemaps.init())
  .pipe(babel())
  .pipe(sourcemaps.write())
  .pipe(gulp.dest('build/src')));

gulp.task('transpile-scripts', () => gulp.src('scripts/**/*.js', { base: 'scripts' })
  .pipe(sourcemaps.init())
  .pipe(babel())
  .pipe(sourcemaps.mapSources(sourcePath => `scripts/${sourcePath}`))
  .pipe(sourcemaps.write())
  .pipe(gulp.dest('build/scripts')));

gulp.task('copy-config', () => gulp.src('src/config/*.json')
  .pipe(gulp.dest('build/src/config')));

gulp.task('copy-node-config', () => gulp.src(['package.json', 'package-lock.json'])
  .pipe(gulp.dest('build')));

gulp.task('copy-tools', () => gulp.src(['wkhtmltopdf-amd64-0.12.4/**/*'], { dot: false })
  .pipe(gulp.dest('build/src/wkhtmltopdf-amd64-0.12.4')));

gulp.task('copy-templates', () => gulp.src(['templates/*'], { dot: false })
  .pipe(gulp.dest('build/templates')));

gulp.task('default', gulp.series('clean', gulp.parallel('transpile', 'transpile-scripts', 'copy-config', 'copy-node-config', 'copy-tools', 'copy-templates')));
