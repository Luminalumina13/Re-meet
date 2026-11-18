import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens a booking or website link outside the app. Returns false if nothing could handle it.
Future<bool> openLink(BuildContext context, String? url) async {
  if (url == null || url.isEmpty) return false;
  final uri = Uri.tryParse(url);
  if (uri == null || !(uri.scheme == 'https' || uri.scheme == 'http' || uri.scheme == 'tg')) return false;
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(url)));
  return ok;
}
