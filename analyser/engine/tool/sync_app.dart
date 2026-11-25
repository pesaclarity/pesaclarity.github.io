// Copies the app's statement and categoriser code into lib/app, unchanged,
// so the analyser compiles the same Dart the app runs.
//
//   dart run tool/sync_app.dart PATH_TO_PESACLARITY_APP_CHECKOUT
//
// Every file is copied byte for byte from lib/src of the app, at the commit
// the checkout is on, except lib/app/mapping.dart: the pure functions of the
// app's transaction_mapping.dart, cut out mechanically (its database
// imports and transactionFromParsed, which writes a database row, are
// dropped). The commit and each file's SHA-256 go to app_sources.json, and
// test/sources_test.dart fails if a copied file is edited by hand.
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';

/// The app's files the analyser runs, relative to the app's lib/src. Their
/// imports are all inside this list, ujumbe or dart:.
const files = [
  'core/money/currency_data.dart',
  'core/money/money.dart',
  'domain/categories/default_categories.dart',
  'features/statements/data/page_words.dart',
  'domain/categoriser/categoriser.dart',
  'domain/categoriser/features.dart',
  'domain/categoriser/learning.dart',
  'domain/categoriser/model_manifest.dart',
  'domain/categoriser/rule_categoriser.dart',
  'domain/categoriser/suggester.dart',
  'domain/categoriser/trainable.dart',
  'domain/enums.dart',
  'domain/ledger/ledger_entry.dart',
  'domain/ledger/ledger_role.dart',
  'domain/ml/plain_weights.dart',
  'domain/payees/payee_identifier.dart',
  'domain/reader/field_values.dart',
  'domain/reader/fuliza_wording.dart',
  'domain/reader/message_reading.dart',
  'domain/reader/model_reader.dart',
  'domain/reader/reader_tokens.dart',
  'domain/reader/reading_template.dart',
  'domain/reader/rule_reader.dart',
  'domain/statements/statement_type.dart',
  'domain/time/calendar.dart',
];

const mappingSource = 'features/sms/application/transaction_mapping.dart';

/// The app's transaction_mapping.dart without its database parts.
String cutMapping(String source) {
  final lines = const LineSplitter().convert(source);
  final out = <String>[
    '// Cut from the app\'s lib/src/$mappingSource by tool/sync_app.dart:',
    '// its database imports and transactionFromParsed are left out.',
  ];
  var skipping = false;
  for (final line in lines) {
    if (line.startsWith("import 'package:drift/")) continue;
    // The database library re-exports the app's enums.
    if (line.contains('app_database.dart')) {
      out.add("import 'domain/enums.dart';");
      continue;
    }
    if (line.startsWith("import '../../../")) {
      out.add(line.replaceFirst("import '../../../", "import '"));
      continue;
    }
    if (line.startsWith('TransactionsCompanion transactionFromParsed(')) {
      skipping = true;
      // Drop the doc comment above it too.
      while (out.isNotEmpty && out.last.startsWith('///')) {
        out.removeLast();
      }
      continue;
    }
    if (skipping) {
      if (line == '}') skipping = false;
      continue;
    }
    out.add(line);
  }
  return '${out.join('\n')}\n';
}

String sha(List<int> bytes) => sha256.convert(bytes).toString();

void main(List<String> args) {
  if (args.length != 1) {
    stderr.writeln('usage: dart run tool/sync_app.dart APP_CHECKOUT');
    exit(64);
  }
  final app = args.single;
  final commit =
      (Process.runSync('git', ['-C', app, 'rev-parse', 'HEAD']).stdout
              as String)
          .trim();
  final dirty =
      (Process.runSync('git', [
                '-C',
                app,
                'status',
                '--porcelain',
                '--',
                'lib',
              ]).stdout
              as String)
          .trim();
  if (dirty.isNotEmpty) {
    stderr.writeln('the app checkout has changes under lib:\n$dirty');
    exit(1);
  }
  final out = Directory('lib/app');
  if (out.existsSync()) out.deleteSync(recursive: true);
  final hashes = <String, String>{};
  for (final f in files) {
    final bytes = File('$app/lib/src/$f').readAsBytesSync();
    File('lib/app/$f')
      ..createSync(recursive: true)
      ..writeAsBytesSync(bytes);
    hashes[f] = sha(bytes);
  }
  final mapping = cutMapping(File('$app/lib/src/$mappingSource').readAsStringSync());
  File('lib/app/mapping.dart').writeAsStringSync(mapping);
  hashes['mapping.dart'] = sha(utf8.encode(mapping));

  // The model the app ships, for the web worker.
  final models = Directory('../models')..createSync(recursive: true);
  for (final m in ['categoriser.weights', 'labels.json', 'model-manifest.json']) {
    final bytes = File('$app/assets/models/categoriser/$m').readAsBytesSync();
    File('${models.path}/$m').writeAsBytesSync(bytes);
    hashes['models/$m'] = sha(bytes);
  }

  final ujumbe = RegExp(
    r'ujumbe:\s*\n\s*git:\s*\n\s*url: (\S+)\s*\n\s*ref: (\S+)',
  ).firstMatch(File('$app/pubspec.yaml').readAsStringSync());
  File('app_sources.json').writeAsStringSync(
    '${const JsonEncoder.withIndent('  ').convert({
      'app': 'https://github.com/pesaclarity/pesaclarity-app',
      'commit': commit,
      'ujumbe': ujumbe?.group(2),
      'files': hashes,
    })}\n',
  );
  stdout.writeln('copied ${hashes.length} files from $commit');
}
