/// The web statement analyser's engine: reads a statement's pages with the
/// app's statement packs and categorises each transaction as the app does
/// on a fresh install (decision 0034).
///
/// Everything under lib/app is the app's own code, copied unchanged by
/// tool/sync_app.dart. This file only joins it up the way the app's
/// statement importer and auto-categoriser do, without a database.
library;

import 'package:ujumbe/ujumbe.dart';

import 'app/domain/categories/default_categories.dart';
import 'app/domain/categoriser/categoriser.dart';
import 'app/domain/categoriser/rule_categoriser.dart';
import 'app/domain/categoriser/suggester.dart';
import 'app/domain/ledger/ledger_entry.dart';
import 'app/domain/ledger/ledger_role.dart';
import 'app/domain/statements/statement_type.dart';
import 'app/mapping.dart';

export 'app/domain/categoriser/categoriser.dart';
export 'app/domain/categoriser/model_manifest.dart';
export 'app/domain/categoriser/rule_categoriser.dart';

/// One statement transaction with the category the app would give it.
class AnalysedTransaction {
  const AnalysedTransaction({
    required this.parsed,
    required this.entry,
    required this.role,
    required this.suggestion,
  });

  final ParsedTransaction parsed;

  /// The ledger row the app would store for it.
  final LedgerEntry entry;
  final LedgerRole role;

  /// The suggestion the app keeps, when it applies on its own; null leaves
  /// the transaction uncategorised.
  final CategorySuggestion? suggestion;

  String? get categoryKey => suggestion?.key;

  Map<String, Object?> toJson() => {
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
    'balanceMinor': parsed.balanceMinor == null
        ? null
        : inCurrencyMinor(parsed.balanceMinor!, parsed.currency),
    'role': role.name,
    'category': suggestion?.key,
    'source': suggestion?.source.name,
    'confidence': suggestion?.confidence,
  };
}

/// What the analyser read from a statement.
sealed class Analysis {
  const Analysis();

  Map<String, Object?> toJson();
}

/// No statement pack reads it; [bankName] when the header names a bank.
final class NotRead extends Analysis {
  const NotRead({this.bankName, required this.hasText});

  final String? bankName;
  final bool hasText;

  @override
  Map<String, Object?> toJson() => {
    'status': hasText ? 'not_read' : 'no_text',
    'bankName': bankName,
  };
}

/// A statement a pack read.
final class StatementAnalysis extends Analysis {
  const StatementAnalysis({
    required this.institution,
    required this.packId,
    required this.periodStart,
    required this.periodEnd,
    required this.openingBalanceMinor,
    required this.closingBalanceMinor,
    required this.unreadCount,
    required this.transactions,
  });

  final String institution;
  final String packId;
  final DateTime? periodStart, periodEnd;
  final int? openingBalanceMinor, closingBalanceMinor;

  /// As the app counts it: unread lines, balance breaks, and one more when
  /// the totals do not match the summary.
  final int unreadCount;
  final List<AnalysedTransaction> transactions;

  @override
  Map<String, Object?> toJson() => {
    'status': 'read',
    'institution': institution,
    'pack': packId,
    'periodStart': periodStart?.toIso8601String(),
    'periodEnd': periodEnd?.toIso8601String(),
    'openingBalanceMinor': openingBalanceMinor,
    'closingBalanceMinor': closingBalanceMinor,
    'unreadCount': unreadCount,
    'transactions': [for (final t in transactions) t.toJson()],
  };
}

/// The app's categories on a fresh install, numbered in seed order.
final List<CategoryOption> seededCategories = [
  for (final (i, c) in defaultCategories.indexed)
    CategoryOption(id: i + 1, key: c.key, type: c.type),
];

/// The app's categoriser: its rules first, then [model] where the rules are
/// not certain, or the rules alone when there is no model.
Categoriser appCategoriser(Categoriser? model) => model == null
    ? const RuleCategoriser()
    : RulesFirstCategoriser(rules: const RuleCategoriser(), model: model);

/// Reads [pages] and categorises every transaction with [categoriser]
/// (normally [appCategoriser]).
Analysis analyse(List<StatementPage> pages, Categoriser categoriser) {
  if (pages.every((page) => page.words.isEmpty)) {
    return const NotRead(hasText: false);
  }
  final pack = detectStatementPack(pages, loadBundledStatementPacks());
  if (pack == null) {
    final first = pages.isEmpty ? '' : pages.first.text;
    return NotRead(
      hasText: true,
      bankName: switch (detectStatementType(first)) {
        BankStatementType(:final bankName) => bankName,
        _ => null,
      },
    );
  }
  final read = StatementReader(pack).read(pages);
  final suggester = CategorySuggester(
    categoriser: categoriser,
    categories: seededCategories,
    corrections: const {},
  );
  final transactions = <AnalysedTransaction>[];
  for (final (i, parsed) in read.transactions.indexed) {
    final entry = ledgerEntryOf(parsed, id: i + 1);
    final suggestion = suggester.suggest(entry);
    transactions.add(
      AnalysedTransaction(
        parsed: parsed,
        entry: entry,
        role: roleOf(entry),
        suggestion: autoApplies(suggestion) ? suggestion : null,
      ),
    );
  }
  return StatementAnalysis(
    institution: pack.institution,
    packId: pack.id,
    periodStart: read.periodStart,
    periodEnd: read.periodEnd,
    openingBalanceMinor: read.openingBalanceMinor,
    closingBalanceMinor: read.closingBalanceMinor,
    unreadCount:
        read.unreadLines.length +
        read.balanceBreaks.length +
        (read.matchesSummary ? 0 : 1),
    transactions: transactions,
  );
}

/// The ledger row the app's statement import stores for [parsed]
/// (transactionFromParsed), with the fields its auto-categoriser reads back
/// (AutoCategoriser builds this LedgerEntry), before any payee is set.
LedgerEntry ledgerEntryOf(ParsedTransaction parsed, {required int id}) {
  final counterparty = counterpartyIdentifier(parsed);
  return LedgerEntry(
    id: id,
    accountId: 1,
    occurredAt: parsed.time,
    amountMinor: inCurrencyMinor(parsed.amountMinor, parsed.currency),
    direction: transactionDirectionFor(parsed.direction),
    kind: transactionKindOf(parsed),
    currency: parsed.currency,
    feeMinor: inCurrencyMinor(parsed.feeMinor ?? 0, parsed.currency),
    counterpartyName: parsed.counterparty,
    counterpartyKind: counterparty?.kind,
    counterpartyValue: counterparty?.value,
  );
}
