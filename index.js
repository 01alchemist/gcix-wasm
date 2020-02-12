const fs = require("fs");
const loader = require("@assemblyscript/loader");
const _exports = loader.instantiateSync(
  fs.readFileSync(__dirname + "/build/untouched.wasm"),
  { /* imports */ })
console.log(_exports.size());
console.log(_exports.ptr());
