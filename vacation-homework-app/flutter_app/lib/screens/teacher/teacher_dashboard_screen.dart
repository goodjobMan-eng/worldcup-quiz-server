import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../data/math_curriculum.dart';
import '../../data/writing_topics.dart';
import '../../models/models.dart';
import '../../services/firestore_service.dart';

/// 선생님용 학급 대시보드 (Teacher Portal)
///  - 탭 1: 본인 학급 학생들의 당일 4대 미션 현황 + 감정 상태 모니터링
///  - 탭 2: 동학년 공동 문제 은행 관리 (수학 28일 / 글쓰기 30일 시드 업로드)
///  - 탭 3: 오늘의 자기 점검 항목 부여
class TeacherDashboardScreen extends StatefulWidget {
  final String classId;
  const TeacherDashboardScreen({super.key, required this.classId});

  @override
  State<TeacherDashboardScreen> createState() =>
      _TeacherDashboardScreenState();
}

class _TeacherDashboardScreenState extends State<TeacherDashboardScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('학급 대시보드')),
      body: switch (_tab) {
        0 => _DailyStatusTab(classId: widget.classId),
        1 => const _ContentBankTab(),
        _ => _SelfCheckTemplateTab(classId: widget.classId),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined), label: '오늘 현황'),
          NavigationDestination(
              icon: Icon(Icons.library_books_outlined), label: '문제 은행'),
          NavigationDestination(
              icon: Icon(Icons.checklist_outlined), label: '자기 점검 부여'),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------
// 탭 1: 당일 미션 현황 + 감정 모니터링
// ---------------------------------------------------------------------
class _DailyStatusTab extends StatelessWidget {
  final String classId;
  const _DailyStatusTab({required this.classId});

  @override
  Widget build(BuildContext context) {
    final fs = FirestoreService.instance;
    return FutureBuilder<SchoolClass>(
      future: fs.getClass(classId),
      builder: (context, classSnap) {
        if (!classSnap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final cls = classSnap.data!;
        return FutureBuilder<List<Map<String, dynamic>>>(
          future: fs.fetchDailyStatus(classId, cls.currentMissionDay),
          builder: (context, snap) {
            if (!snap.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final rows = snap.data!;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  color: Colors.indigo.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${cls.name} · 미션 ${cls.currentMissionDay}일차',
                            style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 4),
                        Text('참여 코드: ${cls.joinCode}'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                ...rows.map((r) => Card(
                      child: ListTile(
                        leading: Text(
                          r['emotionEmoji'] ?? '❔',
                          style: const TextStyle(fontSize: 30),
                        ),
                        title: Text(r['name'] ?? ''),
                        subtitle: (r['emotionComment'] ?? '').isEmpty
                            ? null
                            : Text('💬 ${r['emotionComment']}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _MissionDot(label: '수학', done: r['math']),
                            _MissionDot(label: '글', done: r['writing']),
                            _MissionDot(label: '점검', done: r['selfCheck']),
                          ],
                        ),
                      ),
                    )),
                if (rows.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: Text('아직 가입한 학생이 없어요.')),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

class _MissionDot extends StatelessWidget {
  final String label;
  final bool done;
  const _MissionDot({required this.label, required this.done});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            done ? Icons.check_circle : Icons.radio_button_unchecked,
            color: done ? Colors.green : Colors.grey,
            size: 22,
          ),
          Text(label, style: const TextStyle(fontSize: 10)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------
// 탭 2: 동학년 공동 문제 은행 관리
// ---------------------------------------------------------------------
class _ContentBankTab extends StatefulWidget {
  const _ContentBankTab();

  @override
  State<_ContentBankTab> createState() => _ContentBankTabState();
}

class _ContentBankTabState extends State<_ContentBankTab> {
  bool _busy = false;
  String? _message;

  Future<void> _seedMath() async {
    setState(() => _busy = true);
    final db = FirebaseFirestore.instance;
    final batch = db.batch();
    for (final day in kMathCurriculumSeed) {
      final dayId = 'day${day['day'].toString().padLeft(2, '0')}';
      batch.set(db.doc('mathBank/$dayId'), day, SetOptions(merge: true));
    }
    await batch.commit();
    setState(() {
      _busy = false;
      _message = '✅ 수학 28일 커리큘럼을 문제 은행에 업로드했습니다.';
    });
  }

  Future<void> _seedWriting() async {
    setState(() => _busy = true);
    final db = FirebaseFirestore.instance;
    final batch = db.batch();
    for (final topic in kWritingTopicsSeed) {
      final dayId = 'day${topic['day'].toString().padLeft(2, '0')}';
      batch.set(db.doc('writingTopics/$dayId'), topic, SetOptions(merge: true));
    }
    await batch.commit();
    setState(() {
      _busy = false;
      _message = '✅ 글쓰기 30일 주제를 업로드했습니다.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          '동학년 공동 문제 은행은 6학년 모든 선생님이 함께 관리합니다.\n'
          '아래 버튼으로 기본 커리큘럼을 업로드한 뒤, Firestore 콘솔 또는\n'
          '이 화면(추후 편집 UI)에서 문제를 추가/수정할 수 있습니다.',
          style: TextStyle(color: Colors.grey),
        ),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: const Text('📐', style: TextStyle(fontSize: 30)),
            title: const Text('수학 28일 커리큘럼 초기화'),
            subtitle: const Text('개념 18일 + 혼합 복습 10일'),
            trailing: FilledButton(
              onPressed: _busy ? null : _seedMath,
              child: const Text('업로드'),
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Text('✍️', style: TextStyle(fontSize: 30)),
            title: const Text('글쓰기 30일 주제 초기화'),
            subtitle: const Text('30-Day Writing Project'),
            trailing: FilledButton(
              onPressed: _busy ? null : _seedWriting,
              child: const Text('업로드'),
            ),
          ),
        ),
        if (_message != null)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(_message!, textAlign: TextAlign.center),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------
// 탭 3: 오늘의 자기 점검 항목 부여
// ---------------------------------------------------------------------
class _SelfCheckTemplateTab extends StatefulWidget {
  final String classId;
  const _SelfCheckTemplateTab({required this.classId});

  @override
  State<_SelfCheckTemplateTab> createState() => _SelfCheckTemplateTabState();
}

class _SelfCheckTemplateTabState extends State<_SelfCheckTemplateTab> {
  final _controller = TextEditingController();

  DocumentReference<Map<String, dynamic>> get _templateRef =>
      FirebaseFirestore.instance.doc(
          'classes/${widget.classId}/selfCheckTemplates/${FirestoreService.instance.dateKey()}');

  Future<void> _addItem(List<Map<String, dynamic>> current) async {
    final label = _controller.text.trim();
    if (label.isEmpty) return;
    final items = [
      ...current,
      {'id': DateTime.now().millisecondsSinceEpoch.toString(), 'label': label},
    ];
    await _templateRef.set({'items': items}, SetOptions(merge: true));
    _controller.clear();
  }

  Future<void> _removeItem(
      List<Map<String, dynamic>> current, String id) async {
    await _templateRef.set(
      {'items': current.where((e) => e['id'] != id).toList()},
      SetOptions(merge: true),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: _templateRef.snapshots(),
      builder: (context, snap) {
        final items = List<Map<String, dynamic>>.from(
            snap.data?.data()?['items'] ?? []);
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: const InputDecoration(
                        labelText: '오늘의 점검 항목 추가',
                        hintText: '예: 알림장 확인하기, 독서 30분',
                        border: OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _addItem(items),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    icon: const Icon(Icons.add),
                    onPressed: () => _addItem(items),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Expanded(
                child: items.isEmpty
                    ? const Center(child: Text('오늘 부여한 점검 항목이 없습니다.'))
                    : ListView.builder(
                        itemCount: items.length,
                        itemBuilder: (context, i) => Card(
                          child: ListTile(
                            leading: const Icon(Icons.check_box_outlined),
                            title: Text(items[i]['label']),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () =>
                                  _removeItem(items, items[i]['id']),
                            ),
                          ),
                        ),
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}
