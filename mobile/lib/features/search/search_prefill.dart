import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/requests.dart';
import '../../ui/date_planner.dart';

/// A search handed over from another tab ("All flights here" on a destination): the Search tab
/// fills in the form with it and runs it.
class SearchPrefill {
  const SearchPrefill({required this.from, required this.to, required this.dates, required this.party});
  final Airport from;
  final Airport to;
  final DatePlan dates;
  final Party party;
}

class SearchPrefillNotifier extends Notifier<SearchPrefill?> {
  @override
  SearchPrefill? build() => null;
  void request(SearchPrefill p) => state = p;
  void clear() => state = null;
}

final searchPrefillProvider = NotifierProvider<SearchPrefillNotifier, SearchPrefill?>(SearchPrefillNotifier.new);
