/// Plain data classes parsed from the Re:meeet API. Parsing is tolerant: optional fields may be
/// missing, and unknown fields are ignored, so a newer backend does not break an older app.
typedef Json = Map<String, dynamic>;

double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
String _s(Object? v) => v as String? ?? '';
List<T> _list<T>(Object? v, T Function(Json) f) => ((v as List?) ?? const []).map((e) => f(e as Json)).toList();

class Airport {
  const Airport({required this.iata, required this.name, required this.city, required this.country});
  final String iata;
  final String name;
  final String city;
  final String country;

  factory Airport.fromJson(Json j) => Airport(iata: _s(j['iata']), name: _s(j['name']), city: _s(j['city']), country: _s(j['country']));

  String get label => '$city ($iata)';
}

class Money {
  const Money(this.amount, this.currency);
  final double amount;
  final String currency;
  factory Money.fromJson(Json j) => Money(_d(j['amount']), _s(j['currency']));
}

class Segment {
  const Segment({required this.from, required this.to, required this.carrier, required this.carrierName, required this.flightNumber, required this.departLocal, required this.arriveLocal, required this.durationMin});
  final String from;
  final String to;
  final String carrier;
  final String carrierName;
  final String flightNumber;
  final String departLocal;
  final String arriveLocal;
  final int durationMin;

  factory Segment.fromJson(Json j) => Segment(
        from: _s(j['from']),
        to: _s(j['to']),
        carrier: _s(j['carrier']),
        carrierName: _s(j['carrierName']),
        flightNumber: _s(j['flightNumber']),
        departLocal: _s(j['departLocal']),
        arriveLocal: _s(j['arriveLocal']),
        durationMin: _i(j['durationMin']),
      );
}

class Leg {
  const Leg({required this.from, required this.to, required this.departLocal, required this.arriveLocal, required this.departUtc, required this.arriveUtc, required this.durationMin, required this.stops, required this.segments, this.toCity});
  final String from;
  final String to;
  final String departLocal;
  final String arriveLocal;
  final String departUtc;
  final String arriveUtc;
  final int durationMin;
  final int stops;
  final List<Segment> segments;
  final String? toCity;

  factory Leg.fromJson(Json j) => Leg(
        from: _s(j['from']),
        to: _s(j['to']),
        departLocal: _s(j['departLocal']),
        arriveLocal: _s(j['arriveLocal']),
        departUtc: _s(j['departUtc']),
        arriveUtc: _s(j['arriveUtc']),
        durationMin: _i(j['durationMin']),
        stops: _i(j['stops']),
        segments: _list(j['segments'], Segment.fromJson),
        toCity: j['toCity'] as String?,
      );

  /// "Ryanair, Wizz Air": the operating airlines of this leg, without repeats.
  String get airlines {
    final names = <String>[];
    for (final s in segments) {
      final n = s.carrierName.isNotEmpty ? s.carrierName : s.carrier;
      if (n.isNotEmpty && !names.contains(n)) names.add(n);
    }
    return names.join(', ');
  }

  String get flightNumbers => segments.where((s) => s.flightNumber.isNotEmpty).map((s) => '${s.carrier}${s.flightNumber}').join(' · ');
}

class OtherOffer {
  const OtherOffer({required this.providerName, required this.price, this.deepLink});
  final String providerName;
  final Money price;
  final String? deepLink;
  factory OtherOffer.fromJson(Json j) => OtherOffer(providerName: _s(j['providerName']), price: Money.fromJson(j['price'] as Json), deepLink: j['deepLink'] as String?);
}

class Itinerary {
  const Itinerary({required this.id, required this.provider, required this.providerName, required this.legs, required this.price, this.deepLink, this.otherOffers = const [], this.comfort = 0, this.rank = 0, this.badges = const []});
  final String id;
  final String provider;
  final String providerName;
  final List<Leg> legs;
  final Money price;
  final String? deepLink;
  final List<OtherOffer> otherOffers;
  final int comfort;
  final int rank;
  final List<String> badges;

  factory Itinerary.fromJson(Json j) => Itinerary(
        id: _s(j['id']),
        provider: _s(j['provider']),
        providerName: _s(j['providerName']),
        legs: _list(j['legs'], Leg.fromJson),
        price: Money.fromJson(j['price'] as Json),
        deepLink: j['deepLink'] as String?,
        otherOffers: _list(j['otherOffers'], OtherOffer.fromJson),
        comfort: _i(j['comfort']),
        rank: _i(j['rank']),
        badges: ((j['badges'] as List?) ?? const []).cast<String>(),
      );

  int get totalMinutes => legs.fold(0, (s, l) => s + l.durationMin);
  bool get isDirect => legs.every((l) => l.stops == 0);
}

class ProviderStatus {
  const ProviderStatus({required this.id, required this.name, required this.status, required this.count});
  final String id;
  final String name;
  final String status;
  final int count;
  factory ProviderStatus.fromJson(Json j) => ProviderStatus(id: _s(j['id']), name: _s(j['name']), status: _s(j['status']), count: _i(j['count']));
}

class SearchResult {
  const SearchResult({required this.itineraries, required this.providers, required this.cached});
  final List<Itinerary> itineraries;
  final List<ProviderStatus> providers;
  final bool cached;
  factory SearchResult.fromJson(Json j) => SearchResult(itineraries: _list(j['itineraries'], Itinerary.fromJson), providers: _list(j['providers'], ProviderStatus.fromJson), cached: j['cached'] == true);
}

class Destination {
  const Destination({required this.key, required this.city, required this.country, required this.airports, required this.best, required this.cheapest, required this.options, required this.minutesThere, this.imageUrl});
  final String key;
  final String city;
  final String country;
  final List<String> airports;
  final Itinerary best;
  final Itinerary cheapest;
  final int options;
  final int minutesThere;
  final String? imageUrl;

  factory Destination.fromJson(Json j) => Destination(
        key: _s(j['key']),
        city: _s(j['city']),
        country: _s(j['country']),
        airports: ((j['airports'] as List?) ?? const []).cast<String>(),
        best: Itinerary.fromJson(j['best'] as Json),
        cheapest: Itinerary.fromJson(j['cheapest'] as Json),
        options: _i(j['options']),
        minutesThere: _i(j['minutesThere']),
        imageUrl: j['imageUrl'] as String?,
      );
}

class ExploreResult {
  const ExploreResult({required this.destinations, required this.providers});
  final List<Destination> destinations;
  final List<ProviderStatus> providers;
  factory ExploreResult.fromJson(Json j) => ExploreResult(destinations: _list(j['destinations'], Destination.fromJson), providers: _list(j['providers'], ProviderStatus.fromJson));
}

class Friend {
  const Friend({required this.id, required this.name, required this.origins});
  final String id;
  final String name;
  final List<String> origins;
  factory Friend.fromJson(Json j) => Friend(id: _s(j['id']), name: _s(j['name']), origins: ((j['origins'] as List?) ?? const []).cast<String>());
}

class FriendPlan {
  const FriendPlan({required this.friend, this.outbound, this.inbound, this.arriveUtc, this.departUtc, required this.price});
  final Friend friend;
  final Itinerary? outbound;
  final Itinerary? inbound;
  final String? arriveUtc;
  final String? departUtc;
  final double price;

  bool get isHost => outbound == null;

  factory FriendPlan.fromJson(Json j) => FriendPlan(
        friend: Friend.fromJson(j['friend'] as Json),
        outbound: j['outbound'] == null ? null : Itinerary.fromJson(j['outbound'] as Json),
        inbound: j['inbound'] == null ? null : Itinerary.fromJson(j['inbound'] as Json),
        arriveUtc: j['arriveUtc'] as String?,
        departUtc: j['departUtc'] as String?,
        price: _d(j['price']),
      );
}

class MeetupPlan {
  const MeetupPlan({required this.id, required this.destination, required this.togetherMinutes, required this.totalPrice, required this.currency, required this.meetStartUtc, required this.meetEndUtc, required this.meetStartLocal, required this.meetEndLocal, required this.friends, required this.score});
  final String id;
  final String destination;
  final int togetherMinutes;
  final double totalPrice;
  final String currency;
  final String meetStartUtc;
  final String meetEndUtc;
  final String meetStartLocal;
  final String meetEndLocal;
  final List<FriendPlan> friends;
  final double score;

  factory MeetupPlan.fromJson(Json j) => MeetupPlan(
        id: _s(j['id']),
        destination: _s(j['destination']),
        togetherMinutes: _i(j['togetherMinutes']),
        totalPrice: _d(j['totalPrice']),
        currency: _s(j['currency']),
        meetStartUtc: _s(j['meetStartUtc']),
        meetEndUtc: _s(j['meetEndUtc']),
        meetStartLocal: _s(j['meetStartLocal']),
        meetEndLocal: _s(j['meetEndLocal']),
        friends: _list(j['friends'], FriendPlan.fromJson),
        score: _d(j['score']),
      );
}

class MeetupResult {
  const MeetupResult({required this.plans, required this.unreachable});
  final List<MeetupPlan> plans;
  final int unreachable;
  factory MeetupResult.fromJson(Json j) => MeetupResult(plans: _list(j['plans'], MeetupPlan.fromJson), unreachable: ((j['unreachable'] as List?) ?? const []).length);
}

class FlexOption {
  const FlexOption({required this.price, required this.departUtc, required this.arriveUtc, required this.departLocal, required this.providerName});
  final double price;
  final String departUtc;
  final String arriveUtc;
  final String departLocal;
  final String providerName;
  factory FlexOption.fromJson(Json j) => FlexOption(price: _d(j['price']), departUtc: _s(j['departUtc']), arriveUtc: _s(j['arriveUtc']), departLocal: _s(j['departLocal']), providerName: _s(j['providerName']));
}

class FlexDay {
  const FlexDay({required this.date, required this.price, required this.options, required this.count});
  final String date;
  final double? price;
  final List<FlexOption> options;
  final int count;
  factory FlexDay.fromJson(Json j) => FlexDay(date: _s(j['date']), price: (j['price'] as num?)?.toDouble(), options: _list(j['options'], FlexOption.fromJson), count: _i(j['count']));
}

class PricePoint {
  const PricePoint(this.at, this.bestPrice);
  final String at;
  final double bestPrice;
  factory PricePoint.fromJson(Json j) => PricePoint(_s(j['at']), _d(j['bestPrice']));
}

class WatchAlert {
  const WatchAlert({required this.at, required this.type, required this.message});
  final String at;
  final String type;
  final String message;
  factory WatchAlert.fromJson(Json j) => WatchAlert(at: _s(j['at']), type: _s(j['type']), message: _s(j['message']));
}

class Watch {
  const Watch({required this.id, required this.label, required this.kind, required this.params, required this.currency, this.targetPrice, required this.active, this.lastBestPrice, this.lastCheckedAt, this.history = const [], this.alerts = const [], this.telegramConnected = false});
  final String id;
  final String label;

  /// "search", "explore" or "meetup".
  final String kind;
  final Json params;
  final String currency;
  final double? targetPrice;
  final bool active;
  final double? lastBestPrice;
  final String? lastCheckedAt;
  final List<PricePoint> history;
  final List<WatchAlert> alerts;
  final bool telegramConnected;

  factory Watch.fromJson(Json j) {
    final params = (j['params'] as Json?) ?? const {};
    final notify = (j['notify'] as Json?) ?? const {};
    return Watch(
      id: _s(j['id']),
      label: _s(j['label']),
      kind: _s(params['kind']),
      params: params,
      currency: _s(j['currency']),
      targetPrice: (j['targetPrice'] as num?)?.toDouble(),
      active: j['active'] != false,
      lastBestPrice: (j['lastBestPrice'] as num?)?.toDouble(),
      lastCheckedAt: j['lastCheckedAt'] as String?,
      history: _list(j['history'], PricePoint.fromJson),
      alerts: _list(j['alerts'], WatchAlert.fromJson),
      telegramConnected: notify['telegramVerified'] == true,
    );
  }

  /// Price change between the last two checks, or 0 if there is no history yet.
  double get lastDelta => history.length >= 2 ? history[history.length - 1].bestPrice - history[history.length - 2].bestPrice : 0;
}
