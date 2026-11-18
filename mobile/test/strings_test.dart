import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:remeeet/core/strings.dart';

void main() {
  test('Ukrainian and English have the same keys', () {
    expect(Strings.enKeys.difference(Strings.ukKeys), isEmpty, reason: 'only in English');
    expect(Strings.ukKeys.difference(Strings.enKeys), isEmpty, reason: 'only in Ukrainian');
  });

  test('every key used in the code exists', () {
    final used = <String>{};
    final re = RegExp(r"""\bs\(\s*'([A-Za-z_]+)'""");
    for (final f in Directory('lib').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart') && !f.path.endsWith('core/strings.dart'))) {
      for (final m in re.allMatches(f.readAsStringSync())) {
        used.add(m.group(1)!);
      }
    }
    expect(used, isNotEmpty);
    expect(used.difference(Strings.ukKeys), isEmpty, reason: 'used but not defined');
  });

  test('placeholders are filled, unknown keys fall back to the key', () {
    const s = Strings('uk');
    expect(s('stops', {'n': 2}), 'пересадок: 2');
    expect(const Strings('en')('upTo', {'n': 4}), 'up to 4 h');
    expect(s('no_such_key'), 'no_such_key');
  });

  test('the company name is right in both languages', () {
    expect(const Strings('uk')('rights'), contains('ФОП Павленко'));
    expect(const Strings('en')('rights'), contains('Pavlenko'));
  });
}
