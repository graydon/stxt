/* jshint maxlen: 150 */

// Copyright (c) 2007 Michele Bini
//
// Copyright (c) 2013 Mozilla Foundation
//
//     (Minor modifications, Graydon Hoare)
//
//     - Added mandatory secret-clamp step to curve25519 function
//     - Removed base32 and custom hex encode/decode functions
//     - Removed unused bigint functions, setbit, unused variables
//     - Added inverted-byte-format hex encode/decode functions
//       (that is: 0x1234 => "3212", sequence of 2-hex-char bytes,
//        least significant byte first)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is furnished
// to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function() {

"use strict";

function c255lgetbit(n, c) {
  return Math.floor(n[Math.floor(c / 16)] / Math.pow(2, c % 16)) % 2;
}

function c255lzero() {
  return [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
}

function c255lone() {
  return [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
}

function c255lsqr8h(a7, a6, a5, a4, a3, a2, a1, a0) {
  var r = [];
  var v;
  r[0] = (v = a0*a0) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + 2*a0*a1) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + 2*a0*a2 + a1*a1) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + 2*a0*a3 + 2*a1*a2) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + 2*a0*a4 + 2*a1*a3 + a2*a2) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + 2*a0*a5 + 2*a1*a4 + 2*a2*a3) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + 2*a0*a6 + 2*a1*a5 + 2*a2*a4 + a3*a3) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + 2*a0*a7 + 2*a1*a6 + 2*a2*a5 + 2*a3*a4) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + 2*a1*a7 + 2*a2*a6 + 2*a3*a5 + a4*a4) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + 2*a2*a7 + 2*a3*a6 + 2*a4*a5) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + 2*a3*a7 + 2*a4*a6 + a5*a5) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + 2*a4*a7 + 2*a5*a6) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + 2*a5*a7 + a6*a6) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + 2*a6*a7) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a7*a7) % 0x10000;
  r[15] = Math.floor(v / 0x10000);
  return r;
}

function c255lsqrmodp(a) {
  var x = c255lsqr8h(a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8]);
  var z = c255lsqr8h(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0]);
  var y = c255lsqr8h(a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0]);
  var r = [];
  var v;
  r[0] = (v = 0x800000 + z[0] + (y[8] -x[8] -z[8] + x[0] -0x80) * 38) % 0x10000;
  r[1] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[1] + (y[9] -x[9] -z[9] + x[1]) * 38) % 0x10000;
  r[2] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[2] + (y[10] -x[10] -z[10] + x[2]) * 38) % 0x10000;
  r[3] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[3] + (y[11] -x[11] -z[11] + x[3]) * 38) % 0x10000;
  r[4] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[4] + (y[12] -x[12] -z[12] + x[4]) * 38) % 0x10000;
  r[5] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[5] + (y[13] -x[13] -z[13] + x[5]) * 38) % 0x10000;
  r[6] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[6] + (y[14] -x[14] -z[14] + x[6]) * 38) % 0x10000;
  r[7] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[7] + (y[15] -x[15] -z[15] + x[7]) * 38) % 0x10000;
  r[8] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[8] + y[0] -x[0] -z[0] + x[8] * 38) % 0x10000;
  r[9] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[9] + y[1] -x[1] -z[1] + x[9] * 38) % 0x10000;
  r[10] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[10] + y[2] -x[2] -z[2] + x[10] * 38) % 0x10000;
  r[11] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[11] + y[3] -x[3] -z[3] + x[11] * 38) % 0x10000;
  r[12] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[12] + y[4] -x[4] -z[4] + x[12] * 38) % 0x10000;
  r[13] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[13] + y[5] -x[5] -z[5] + x[13] * 38) % 0x10000;
  r[14] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[14] + y[6] -x[6] -z[6] + x[14] * 38) % 0x10000;
  r[15] = 0x7fff80 + Math.floor(v / 0x10000) + z[15] + y[7] -x[7] -z[7] + x[15] * 38;
  c255lreduce(r);
  return r;
}

function c255lmul8h(a7, a6, a5, a4, a3, a2, a1, a0, b7, b6, b5, b4, b3, b2, b1, b0) {
  var r = [];
  var v;
  r[0] = (v = a0*b0) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a0*b1 + a1*b0) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a0*b2 + a1*b1 + a2*b0) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a0*b3 + a1*b2 + a2*b1 + a3*b0) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a0*b4 + a1*b3 + a2*b2 + a3*b1 + a4*b0) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a0*b5 + a1*b4 + a2*b3 + a3*b2 + a4*b1 + a5*b0) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a0*b6 + a1*b5 + a2*b4 + a3*b3 + a4*b2 + a5*b1 + a6*b0) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a0*b7 + a1*b6 + a2*b5 + a3*b4 + a4*b3 + a5*b2 + a6*b1 + a7*b0) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a1*b7 + a2*b6 + a3*b5 + a4*b4 + a5*b3 + a6*b2 + a7*b1) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a2*b7 + a3*b6 + a4*b5 + a5*b4 + a6*b3 + a7*b2) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a3*b7 + a4*b6 + a5*b5 + a6*b4 + a7*b3) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a4*b7 + a5*b6 + a6*b5 + a7*b4) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a5*b7 + a6*b6 + a7*b5) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a6*b7 + a7*b6) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a7*b7) % 0x10000;
  r[15] = Math.floor(v / 0x10000);
  return r;
}

function
c255lmulmodp(a, b) {
  // Karatsuba multiplication scheme: x*y = (b^2+b)*x1*y1 - b*(x1-x0)*(y1-y0) + (b+1)*x0*y0
  var x = c255lmul8h(a[15], a[14], a[13], a[12], a[11], a[10], a[9], a[8], b[15], b[14], b[13], b[12], b[11], b[10], b[9], b[8]);
  var z = c255lmul8h(a[7], a[6], a[5], a[4], a[3], a[2], a[1], a[0], b[7], b[6], b[5], b[4], b[3], b[2], b[1], b[0]);
  var y = c255lmul8h(a[15] + a[7], a[14] + a[6], a[13] + a[5], a[12] + a[4], a[11] + a[3], a[10] + a[2], a[9] + a[1], a[8] + a[0],
                          b[15] + b[7], b[14] + b[6], b[13] + b[5], b[12] + b[4], b[11] + b[3], b[10] + b[2], b[9] + b[1], b[8] + b[0]);
  var r = [];
  var v;
  r[0] = (v = 0x800000 + z[0] + (y[8] -x[8] -z[8] + x[0] -0x80) * 38) % 0x10000;
  r[1] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[1] + (y[9] -x[9] -z[9] + x[1]) * 38) % 0x10000;
  r[2] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[2] + (y[10] -x[10] -z[10] + x[2]) * 38) % 0x10000;
  r[3] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[3] + (y[11] -x[11] -z[11] + x[3]) * 38) % 0x10000;
  r[4] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[4] + (y[12] -x[12] -z[12] + x[4]) * 38) % 0x10000;
  r[5] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[5] + (y[13] -x[13] -z[13] + x[5]) * 38) % 0x10000;
  r[6] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[6] + (y[14] -x[14] -z[14] + x[6]) * 38) % 0x10000;
  r[7] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[7] + (y[15] -x[15] -z[15] + x[7]) * 38) % 0x10000;
  r[8] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[8] + y[0] -x[0] -z[0] + x[8] * 38) % 0x10000;
  r[9] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[9] + y[1] -x[1] -z[1] + x[9] * 38) % 0x10000;
  r[10] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[10] + y[2] -x[2] -z[2] + x[10] * 38) % 0x10000;
  r[11] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[11] + y[3] -x[3] -z[3] + x[11] * 38) % 0x10000;
  r[12] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[12] + y[4] -x[4] -z[4] + x[12] * 38) % 0x10000;
  r[13] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[13] + y[5] -x[5] -z[5] + x[13] * 38) % 0x10000;
  r[14] = (v = 0x7fff80 + Math.floor(v / 0x10000) + z[14] + y[6] -x[6] -z[6] + x[14] * 38) % 0x10000;
  r[15] = 0x7fff80 + Math.floor(v / 0x10000) + z[15] + y[7] -x[7] -z[7] + x[15] * 38;
  c255lreduce(r);
  return r;
}

function c255lreduce(a) {
  var v = a[15];
  if (v < 0x8000) { return; }
  a[15] = v % 0x8000;
  v = Math.floor(v / 0x8000) * 19;
  a[0] = (v += a[0]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[1] = (v += a[1]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[2] = (v += a[2]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[3] = (v += a[3]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[4] = (v += a[4]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[5] = (v += a[5]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[6] = (v += a[6]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[7] = (v += a[7]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[8] = (v += a[8]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[9] = (v += a[9]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[10] = (v += a[10]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[11] = (v += a[11]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[12] = (v += a[12]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[13] = (v += a[13]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[14] = (v += a[14]) % 0x10000;
  if ((v = Math.floor(v / 0x10000)) < 1) { return; }
  a[15] += v;
}

function c255laddmodp(a, b) {
  var r = [];
  var v;
  r[0] = (v = (Math.floor(a[15] / 0x8000) + Math.floor(b[15] / 0x8000)) * 19 + a[0] + b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a[1] + b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a[2] + b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a[3] + b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a[4] + b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a[5] + b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a[6] + b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a[7] + b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a[8] + b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a[9] + b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a[10] + b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a[11] + b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a[12] + b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a[13] + b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a[14] + b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + a[15] % 0x8000 + b[15] % 0x8000;
  return r;
}

function c255lsubmodp(a, b) {
  var r = [];
  var v;
  r[0] = (v = 0x80000 + (Math.floor(a[15] / 0x8000) - Math.floor(b[15] / 0x8000) - 1) * 19 + a[0] - b[0]) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[1] - b[1]) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[2] - b[2]) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[3] - b[3]) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[4] - b[4]) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[5] - b[5]) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[6] - b[6]) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[7] - b[7]) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[8] - b[8]) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[9] - b[9]) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[10] - b[10]) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[11] - b[11]) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[12] - b[12]) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[13] - b[13]) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + 0x7fff8 + a[14] - b[14]) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + 0x7ff8 + a[15]%0x8000 - b[15]%0x8000;
  return r;
}

function
c255linvmodp(a) {
  var c = a;
  var i = 250;
  while (--i) {
    a = c255lsqrmodp(a);
    a = c255lmulmodp(a, c);
  }
  a = c255lsqrmodp(a);
  a = c255lsqrmodp(a); a = c255lmulmodp(a, c);
  a = c255lsqrmodp(a);
  a = c255lsqrmodp(a); a = c255lmulmodp(a, c);
  a = c255lsqrmodp(a); a = c255lmulmodp(a, c);
  return a;
}

function c255lmulasmall(a) {
  var m = 121665;
  var r = [];
  var v;
  r[0] = (v = a[0] * m) % 0x10000;
  r[1] = (v = Math.floor(v / 0x10000) + a[1]*m) % 0x10000;
  r[2] = (v = Math.floor(v / 0x10000) + a[2]*m) % 0x10000;
  r[3] = (v = Math.floor(v / 0x10000) + a[3]*m) % 0x10000;
  r[4] = (v = Math.floor(v / 0x10000) + a[4]*m) % 0x10000;
  r[5] = (v = Math.floor(v / 0x10000) + a[5]*m) % 0x10000;
  r[6] = (v = Math.floor(v / 0x10000) + a[6]*m) % 0x10000;
  r[7] = (v = Math.floor(v / 0x10000) + a[7]*m) % 0x10000;
  r[8] = (v = Math.floor(v / 0x10000) + a[8]*m) % 0x10000;
  r[9] = (v = Math.floor(v / 0x10000) + a[9]*m) % 0x10000;
  r[10] = (v = Math.floor(v / 0x10000) + a[10]*m) % 0x10000;
  r[11] = (v = Math.floor(v / 0x10000) + a[11]*m) % 0x10000;
  r[12] = (v = Math.floor(v / 0x10000) + a[12]*m) % 0x10000;
  r[13] = (v = Math.floor(v / 0x10000) + a[13]*m) % 0x10000;
  r[14] = (v = Math.floor(v / 0x10000) + a[14]*m) % 0x10000;
  r[15] = Math.floor(v / 0x10000) + a[15]*m;
  c255lreduce(r);
  return r;
}

function c255ldbl(x, z) {
  var x_2, z_2, m, n, o;
  m = c255lsqrmodp(c255laddmodp(x, z));
  n = c255lsqrmodp(c255lsubmodp(x, z));
  o = c255lsubmodp(m, n);
  x_2 = c255lmulmodp(n, m);
  z_2 = c255lmulmodp(c255laddmodp(c255lmulasmall(o), m), o);
  return [x_2, z_2];
}

function c255lsum(x, z, x_p, z_p, x_1) {
  var x_3, z_3, p, q;
  p = c255lmulmodp(c255lsubmodp(x, z), c255laddmodp(x_p, z_p));
  q = c255lmulmodp(c255laddmodp(x, z), c255lsubmodp(x_p, z_p));
  x_3 = c255lsqrmodp(c255laddmodp(p, q));
  z_3 = c255lmulmodp(c255lsqrmodp(c255lsubmodp(p, q)), x_1);
  return [x_3, z_3];
}

function curve25519(f, c) {
  var a, x_1, q;

  // graydon: added secret-clamping step: required (by djb) to be done
  // before calling 25519 scalarmult, to mitigate small-subgroup attacks.
  //
  // including this step in this function is standard conservative behavior
  // in other 25519 impls: donna, nacl, cryptocat.
  f[0] &= 0xFFF8;
  f[15] &= 0x7FFF;
  f[15] |= 0x4000;

  x_1 = c;
  a = c255ldbl(x_1, c255lone());
  q = [ x_1, c255lone() ];

  var n = 255;

  while (c255lgetbit(f, n) === 0) {
    n--;
    if (n < 0) {
      return c255lzero();
    }
  }
  n--;

  while (n >= 0) {
    var nn, n_a;
    var b = c255lgetbit(f, n);
    if (b === 0) {
      nn = c255ldbl(q[0], q[1]);
      n_a = c255lsum(a[0], a[1], q[0], q[1], x_1);
    } else {
      nn = c255lsum(a[0], a[1], q[0], q[1], x_1);
      n_a = c255ldbl(a[0], a[1]);
    }
    q = nn; a = n_a;
    n--;
  }

  q[1] = c255linvmodp(q[1]);
  q[0] = c255lmulmodp(q[0], q[1]);
  c255lreduce(q[0]);
  return q[0];
}

// graydon: added 2 helpers for direct enc/dec of hex strings
// in the format that donna generates its test vectors

function c255_from_inverted_bytes_hex(x) {
    //  in: "3412000000000000000000000000000000000000000000000000000000000000"
    // out: [0x1234,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
    var out = [];
    x.replace(/(....)/g, function(s) {
        out.push(parseInt(s[2] + s[3] + s[0] + s[1], 16));
    });
    return out;
}

function c255_to_inverted_bytes_hex(x) {
    //  in: [0x1234,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
    // out: "3412000000000000000000000000000000000000000000000000000000000000"
    var out = "";
    var chars = "0123456789abcdef";
    x.forEach(function(word) {
        out += chars[((word >>  4) & 0xf)];
        out += chars[((word      ) & 0xf)];
        out += chars[((word >> 12) & 0xf)];
        out += chars[((word >>  8) & 0xf)];
    });
    return out;
}

module.exports = {
    from_hex: c255_from_inverted_bytes_hex,
    to_hex: c255_to_inverted_bytes_hex,
    crypto_scalarmult: curve25519
};


})();
