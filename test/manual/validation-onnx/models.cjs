const assert = require('node:assert/strict');

// Modelos propios de QA, IR 8/opset 13, conforme onnx/onnx.proto3.
// El codificador sólo necesita varint positivo y campos de bytes; no lee modelos externos.
function integer(value) {
  assert.ok(Number.isSafeInteger(value) && value >= 0);
  const bytes = [];
  do { const byte = value % 128; value = Math.floor(value / 128); bytes.push(byte | (value ? 128 : 0)); } while (value);
  return Buffer.from(bytes);
}
const number = (field, value) => Buffer.concat([integer(field * 8), integer(value)]);
const bytes = (field, value) => {
  const data = typeof value === 'string' ? Buffer.from(value) : Buffer.concat([value]);
  return Buffer.concat([integer(field * 8 + 2), integer(data.length), data]);
};
const message = (...fields) => Buffer.concat(fields);
function valueInfo(name, dims) {
  const shape = message(...dims.map(dim => bytes(1, number(1, dim))));
  return message(bytes(1, name), bytes(2, bytes(1, message(number(1, 1), bytes(2, shape)))));
}
function model(node, inputDims, outputDims) {
  const graph = message(bytes(1, node), bytes(2, 'modelo-propio-de-qa'), bytes(11, valueInfo('X', inputDims)), bytes(12, valueInfo('Y', outputDims)));
  return message(number(1, 8), bytes(2, 'Soflia-QA'), bytes(7, graph), bytes(8, number(2, 13)));
}
exports.identityModel = () => model(message(bytes(1, 'X'), bytes(2, 'Y'), bytes(4, 'Identity')), [1, 3], [1, 3]);
exports.detectionModel = () => {
  const data = Array(50).fill(0);
  // Dos cajas coincidentes: NMS debe conservar la primera; diez anclas y una clase.
  for (const anchor of [0, 1]) {
    data[anchor] = 8; data[10 + anchor] = 8; data[20 + anchor] = 8; data[30 + anchor] = 4;
    data[40 + anchor] = anchor ? 0.8 : 0.9;
  }
  const raw = Buffer.alloc(data.length * 4); data.forEach((value, index) => raw.writeFloatLE(value, index * 4));
  const tensor = message(...[1, 5, 10].map(dim => number(1, dim)), number(2, 1), bytes(9, raw));
  const attribute = message(bytes(1, 'value'), number(20, 4), bytes(5, tensor));
  return model(message(bytes(2, 'Y'), bytes(4, 'Constant'), bytes(5, attribute)), [1, 3, 16, 16], [1, 5, 10]);
};
