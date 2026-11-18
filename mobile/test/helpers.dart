import 'dart:convert';
import 'dart:io';

import 'package:remeeet/core/models.dart';

/// Reads a captured API response from test/fixtures.
Json fixture(String name) => jsonDecode(File('test/fixtures/$name').readAsStringSync()) as Json;

List<dynamic> fixtureList(String name) => jsonDecode(File('test/fixtures/$name').readAsStringSync()) as List<dynamic>;
