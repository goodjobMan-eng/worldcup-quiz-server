import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

/// 일일 자기 점검 체크리스트 (Self-Check Mission)
///
/// - 선생님이 부여한 당일 항목(classes/{classId}/selfCheckTemplates/{dateKey})을 읽어와
///   학생이 항목별 체크박스를 탭하면 본인 문서
///   (students/{uid}/selfChecks/{dateKey})에 진행도를 저장한다.
/// - 모든 항목 완료 시 allDone = true 로 기록되어 스케줄러 검사 대상에서 제외된다.
class SelfCheckList extends StatelessWidget {
  final String classId;
  final String studentUid;
  final String dateKey; // 예: "2026-07-20"

  const SelfCheckList({
    super.key,
    required this.classId,
    required this.studentUid,
    required this.dateKey,
  });

  DocumentReference<Map<String, dynamic>> get _templateRef =>
      FirebaseFirestore.instance
          .doc('classes/$classId/selfCheckTemplates/$dateKey');

  DocumentReference<Map<String, dynamic>> get _progressRef =>
      FirebaseFirestore.instance
          .doc('classes/$classId/students/$studentUid/selfChecks/$dateKey');

  Future<void> _toggle(
      List<Map<String, dynamic>> items, Set<String> checked, String id) async {
    final next = Set<String>.from(checked);
    next.contains(id) ? next.remove(id) : next.add(id);
    await _progressRef.set({
      'checkedItemIds': next.toList(),
      'allDone': next.length == items.length,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: _templateRef.snapshots(),
      builder: (context, templateSnap) {
        if (!templateSnap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final items = List<Map<String, dynamic>>.from(
            templateSnap.data?.data()?['items'] ?? []);
        if (items.isEmpty) {
          return const Center(child: Text('오늘은 선생님이 내주신 점검 항목이 없어요 🙌'));
        }

        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: _progressRef.snapshots(),
          builder: (context, progressSnap) {
            final checked = Set<String>.from(
                progressSnap.data?.data()?['checkedItemIds'] ?? []);
            final progress = items.isEmpty ? 0.0 : checked.length / items.length;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(
                        '오늘의 자기 점검 (${checked.length}/${items.length})',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      LinearProgressIndicator(
                        value: progress,
                        minHeight: 10,
                        borderRadius: BorderRadius.circular(5),
                      ),
                      if (progress == 1.0)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text('🌟 오늘의 자기 점검 완료! 멋져요!',
                              style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: items.length,
                    itemBuilder: (context, i) {
                      final item = items[i];
                      final id = item['id'] as String;
                      return CheckboxListTile(
                        title: Text(item['label'] as String),
                        value: checked.contains(id),
                        onChanged: (_) => _toggle(items, checked, id),
                        controlAffinity: ListTileControlAffinity.leading,
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
