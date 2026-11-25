// The engine's entry point for the browser: sets globalThis.pesaclarityEngine
// to an object of functions that take and return JSON strings, so the Web
// Worker (analyser/web/worker.mjs) never sees Dart objects.
//
// Compiled with `dart compile wasm` (tool/build.sh). Not with dart2js: the
// encoders' 32-bit FNV-1a hashes multiply past 2^53, which JavaScript
// numbers cannot hold exactly; Dart's wasm target has real 64-bit ints.
import 'dart:convert';
import 'dart:typed_data';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:pesaclarity_analyser/analyser.dart';
import 'package:pesaclarity_analyser/app/domain/categoriser/features.dart'
    as features;
import 'package:pesaclarity_analyser/app/domain/reader/reader_tokens.dart'
    as reader;
import 'package:pesaclarity_analyser/app/features/statements/data/page_words.dart';
import 'package:ujumbe/ujumbe.dart';

/// The JS side of the model: runs one encoded row on rayo.
extension type JsRunner(JSObject _) implements JSObject {
  external int get outputSize;
  external JSFloat32Array run(JSInt32Array row);
}

/// rayo, through the worker, as the app's CategoriserRuntime.
class _JsRuntime implements CategoriserRuntime {
  _JsRuntime(this._runner);

  final JsRunner _runner;

  @override
  int get outputSize => _runner.outputSize;

  @override
  List<double> run(List<int> row) => _runner
      .run(Int32List.fromList(row).toJS)
      .toDart
      .map((v) => v.toDouble())
      .toList();

  @override
  void close() {}
}

Map<String, Object?> _obj(String json) =>
    (jsonDecode(json) as Map).cast<String, Object?>();

/// Pages from the worker: per page, its height and each character with its
/// box in PDF coordinates, read as the app reads PDFium's.
List<StatementPage> _pages(String json) => [
  for (final p in (jsonDecode(json) as List).cast<Map<String, Object?>>())
    pageFromCharacters(p['text']! as String, [
      for (final b in (p['boxes']! as List).cast<List<Object?>>())
        (
          (b[0]! as num).toDouble(),
          (b[1]! as num).toDouble(),
          (b[2]! as num).toDouble(),
          (b[3]! as num).toDouble(),
        ),
    ], pageHeight: (p['height']! as num).toDouble()),
];

Categoriser? _model;

void main() {
  final engine = JSObject();
  // manifest, labels: the bundled JSON files; runner: JsRunner. Returns
  // null, or the reasons the app would refuse the model.
  engine['loadModel'] = ((String manifest, String labels, JsRunner runner) {
    try {
      _model = ModelCategoriser(
        manifest: ModelManifest.fromJson(_obj(manifest)),
        labels: ModelLabels.fromJson(_obj(labels)),
        runtime: _JsRuntime(runner),
      );
      return null;
    } on Object catch (e) {
      _model = null;
      return '$e';
    }
  }).toJS;
  engine['analyse'] = ((String pages) =>
      jsonEncode(analyse(_pages(pages), appCategoriser(_model)).toJson())).toJS;
  engine['pageWords'] = ((String pages) => jsonEncode([
    for (final p in _pages(pages))
      [for (final w in p.words) [w.text, w.left, w.top, w.right, w.bottom]],
  ])).toJS;
  engine['pageText'] = ((String pages) =>
      jsonEncode([for (final p in _pages(pages)) p.text])).toJS;
  // The categoriser's encoder: {payee, amount_minor, direction, timestamp_ms}.
  engine['encodeFeatures'] = ((String input) {
    final i = _obj(input);
    final payee = i['payee']! as String;
    return jsonEncode({
      'tokens': features.tokenise(payee),
      'features': features.encodeFeatures(
        features.FeatureInput(
          payee: payee,
          amountMinor: i['amount_minor']! as int,
          isInflow: i['direction'] == 'in',
          timestampMs: i['timestamp_ms']! as int,
        ),
      ),
    });
  }).toJS;
  // The message reader's encoder.
  engine['encodeMessage'] = ((String message) {
    final tokens = reader.tokenise(message);
    return jsonEncode({
      'tokens': [
        for (final t in tokens)
          {
            'text': t.text,
            'start': t.start,
            'end': t.end,
            'shape': t.shape.index,
            'hash_key': reader.hashKey(t.text),
            'id': reader.tokenId(t.text),
          },
      ],
      'token_count': tokens.length,
      'input': reader.encodeTokens(tokens),
    });
  }).toJS;
  globalContext['pesaclarityEngine'] = engine;
}
