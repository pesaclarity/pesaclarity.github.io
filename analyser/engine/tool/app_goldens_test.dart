// Records what the app itself reads from the analyser's synthetic
// statements, as the golden the web engine must match. It runs inside a
// pesaclarity-app checkout, on the app's own code: PDFium for the words,
// the app's statement reader, transactionFromParsed for the stored row, and
// the bundled categoriser on rayo with the rules first.
//
// tool/app_goldens.sh copies it into the app's test/ and runs it with
// `flutter test`; nothing here is part of the app.
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pdfrx_engine/pdfrx_engine.dart';
import 'package:pesaclarity/src/domain/categories/default_categories.dart';
import 'package:pesaclarity/src/domain/categoriser/suggester.dart';
import 'package:pesaclarity/src/domain/enums.dart';
import 'package:pesaclarity/src/domain/ledger/ledger_entry.dart';
import 'package:pesaclarity/src/domain/ledger/ledger_role.dart';
import 'package:pesaclarity/src/features/categoriser/data/model_store.dart';
import 'package:pesaclarity/src/features/categoriser/data/rayo_categoriser_runtime.dart';
import 'package:pesaclarity/src/features/sms/application/transaction_mapping.dart';
import 'package:pesaclarity/src/features/statements/application/statement_importer.dart';
import 'package:pesaclarity/src/features/statements/data/pdf_text_extractor.dart';
import 'package:pesaclarity/src/features/statements/data/pdfium_text_extractor.dart';

String? _hostPdfium() {
  final build = Directory('.dart_tool/hooks_runner/shared/pdfium_dart/build');
  if (!build.existsSync()) return null;
  for (final entity in build.listSync(recursive: true)) {
    if (entity is File && entity.path.endsWith('/libpdfium.so')) {
      return entity.absolute.path;
    }
  }
  return null;
}

Future<Uint8List?> _asset(String path) async {
  try {
    final data = await rootBundle.load(path);
    return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
  } on Object {
    return null;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final fixtures = Platform.environment['ANALYSER_FIXTURES']!;
  final out = Platform.environment['ANALYSER_GOLDENS']!;

  test('records the app goldens', () async {
    final dir = await Directory.systemTemp.createTemp('pdfrx');
    Pdfrx.pdfiumModulePath = _hostPdfium()!;
    final extractor = PdfiumTextExtractor(tempDirectory: dir.path);
    final loaded = await loadCategoriser(
      readAsset: _asset,
      openRuntime: openCategoriserRuntime,
    );
    expect(loaded.status, ModelStatus.loaded, reason: '${loaded.reasons}');
    final suggester = CategorySuggester(
      categoriser: loaded.categoriser,
      categories: [
        for (final (i, c) in defaultCategories.indexed)
          CategoryOption(id: i + 1, key: c.key, type: c.type),
      ],
      corrections: const {},
    );

    final index =
        (jsonDecode(File('$fixtures/statements.json').readAsStringSync())
                as List)
            .cast<Map<String, Object?>>();
    for (final f in index) {
      final bytes = File('$fixtures/${f['file']}').readAsBytesSync();
      final password = f['password'] as String?;
      if (password != null) {
        await expectLater(
          extractor.extractPages(bytes),
          throwsA(isA<PdfPasswordRequired>()),
        );
        await expectLater(
          extractor.extractPages(bytes, password: '${password}9'),
          throwsA(isA<PdfWrongPassword>()),
        );
      }
      final pages = await extractor.extractPages(bytes, password: password);
      final read = readStatement(pages)!;
      final transactions = <Map<String, Object?>>[];
      for (final (i, parsed) in read.transactions.indexed) {
        final tx = transactionFromParsed(parsed, accountId: 1);
        // As AutoCategoriser builds it, with no payee yet.
        final entry = LedgerEntry(
          id: i + 1,
          accountId: tx.accountId.value,
          occurredAt: tx.occurredAt.value,
          amountMinor: tx.amountMinor.value,
          direction: tx.direction.value,
          kind: tx.kind.value ?? TransactionKind.bank,
          currency: tx.currency.value,
          feeMinor: tx.feeMinor.value,
          counterpartyName: tx.counterpartyName.value,
          counterpartyKind: tx.counterpartyKind.value,
          counterpartyValue: tx.counterpartyValue.value,
        );
        final s = suggester.suggest(entry);
        final kept = autoApplies(s) ? s : null;
        transactions.add({
          'time': parsed.time.toUtc().toIso8601String(),
          'direction': entry.direction.name,
          'kind': entry.kind.name,
          'amountMinor': entry.amountMinor,
          'feeMinor': entry.feeMinor,
          'currency': entry.currency,
          'counterparty': entry.counterpartyName,
          'counterpartyKind': entry.counterpartyKind?.name,
          'counterpartyValue': entry.counterpartyValue,
          'receipt': parsed.receipt,
          'balanceMinor': tx.balanceAfterMinor.value,
          'role': roleOf(entry).name,
          'category': kept?.key,
          'source': kept?.source.name,
          'confidence': kept?.confidence,
        });
      }
      final golden = {
        'note':
            'What the app reads from ${f['file']} (synthetic): PDFium, '
            'the app statement reader and its categoriser on rayo. Written '
            'by analyser/engine/tool/app_goldens.sh; do not edit.',
        'app': Platform.environment['APP_COMMIT'],
        'institution': read.institutionId,
        'periodStart': read.periodStart?.toIso8601String(),
        'periodEnd': read.periodEnd?.toIso8601String(),
        'openingBalanceMinor': read.openingBalanceMinor,
        'closingBalanceMinor': read.closingBalanceMinor,
        'unreadCount': read.unreadCount,
        // The pages as the statement reader sees them, for finding where
        // the browser's extraction differs.
        'pageText': [for (final p in pages) p.text],
        'transactions': transactions,
      };
      final name = (f['file']! as String).replaceAll('.pdf', '.golden.json');
      File('$out/$name').writeAsStringSync(
        '${const JsonEncoder.withIndent(' ').convert(golden)}\n',
      );
    }
    loaded.categoriser.close();
  });
}
