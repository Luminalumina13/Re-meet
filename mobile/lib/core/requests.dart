import 'dates.dart';
import 'models.dart';

/// Who travels and in which cabin. Same limits as the API: an adult per infant, nine seats at most.
class Party {
  const Party({this.adults = 1, this.children = 0, this.infants = 0, this.cabin = 'economy'});
  final int adults;
  final int children;
  final int infants;
  final String cabin;

  int get total => adults + children + infants;

  Party copyWith({int? adults, int? children, int? infants, String? cabin}) {
    var a = adults ?? this.adults;
    var c = children ?? this.children;
    var i = infants ?? this.infants;
    a = a.clamp(1, 9);
    c = c.clamp(0, 8);
    i = i.clamp(0, 4);
    if (i > a) i = a;
    while (a + c + i > 9) {
      if (c > 0 && (children != null || a == 1)) {
        c--;
      } else if (i > 0) {
        i--;
      } else if (a > 1) {
        a--;
      } else {
        break;
      }
    }
    return Party(adults: a, children: c, infants: i, cabin: cabin ?? this.cabin);
  }

  Json toJson() => {'adults': adults, 'children': children, 'infants': infants, 'cabin': cabin};
}

Json searchRequest({required String from, required String to, required DateRange range, required Party party, TimeFilters? filters}) => {
      'origin': from,
      'destination': to,
      'departDate': range.depart,
      'returnDate': ?range.ret,
      ...party.toJson(),
      'currency': 'EUR',
      if (filters != null && !filters.isEmpty) 'filters': filters.toJson(),
    };

Json exploreRequest({required String from, required DateRange range, required Party party, required int maxHours, required bool directOnly, double? budget, TimeFilters? filters}) {
  final f = <String, dynamic>{...?filters?.toJson(), if (directOnly) 'maxStops': 0, 'maxPrice': ?budget};
  return {
    'origin': from,
    'departDate': range.depart,
    'returnDate': range.ret,
    ...party.toJson(),
    'currency': 'EUR',
    'maxFlightHours': maxHours,
    if (f.isNotEmpty) 'filters': f,
  };
}

Json meetupRequest({required List<({String id, String name, List<String> origins})> friends, required List<String> destinations, required DateRange range, required int valuePerHour, double? budget, TimeFilters? filters, String cabin = 'economy'}) => {
      'friends': [for (final f in friends) {'id': f.id, 'name': f.name, 'origins': f.origins}],
      'destinations': destinations,
      'departDate': range.depart,
      'returnDate': range.ret,
      'cabin': cabin,
      'currency': 'EUR',
      'valuePerHour': valuePerHour,
      'maxBudgetPerPerson': ?budget,
      if (filters != null && !filters.isEmpty) 'filters': filters.toJson(),
      'topK': 6,
    };

/// One day of the flexible-dates grid.
Json flexDayRequest({required String from, required String to, required String date, required String direction, required Party party, TimeFilters? filters}) => {
      'origin': from,
      'destination': to,
      'date': date,
      'direction': direction,
      ...party.toJson(),
      'currency': 'EUR',
      if (filters != null && !filters.isEmpty) 'filters': filters.toJson(),
    };
