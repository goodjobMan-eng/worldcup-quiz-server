import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../widgets/self_check_list.dart';
import 'math_mission_screen.dart';
import 'writing_screen.dart';

/// 학생 홈 — 오늘의 4대 미션 진입점 + 알림
class StudentHomeScreen extends StatelessWidget {
  final AppUser user;
  const StudentHomeScreen({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final fs = FirestoreService.instance;
    return FutureBuilder<SchoolClass>(
      future: fs.getClass(user.classId!),
      builder: (context, snap) {
        if (!snap.hasData) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final cls = snap.data!;
        final day = cls.currentMissionDay;

        return Scaffold(
          appBar: AppBar(
            title: Text('${cls.name} · ${user.name}'),
            actions: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        _NotificationScreen(classId: user.classId!),
                  ),
                ),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                color: Colors.indigo.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    day >= 1
                        ? '📅 방학 미션 $day일차'
                        : '방학 미션이 아직 시작되지 않았어요!',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              _MissionTile(
                emoji: '📐',
                title: '오늘의 수학',
                subtitle: '6학년 1학기 맞춤 학습 (28일)',
                enabled: day >= 1 && day <= 28,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => MathMissionScreen(day: day)),
                ),
              ),
              _MissionTile(
                emoji: '✍️',
                title: '30일 주제 글쓰기',
                subtitle: '연속 제출에 도전해요!',
                enabled: day >= 1 && day <= 30,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => WritingScreen(
                        classId: user.classId!, currentDay: day),
                  ),
                ),
              ),
              _MissionTile(
                emoji: '✅',
                title: '자기 점검 체크리스트',
                subtitle: '오늘의 할 일을 스스로 점검해요',
                enabled: true,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => Scaffold(
                      appBar: AppBar(title: const Text('자기 점검')),
                      body: SelfCheckList(
                        classId: user.classId!,
                        studentUid: user.uid,
                        dateKey: fs.dateKey(),
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

class _MissionTile extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final bool enabled;
  final VoidCallback onTap;

  const _MissionTile({
    required this.emoji,
    required this.title,
    required this.subtitle,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        enabled: enabled,
        leading: Text(emoji, style: const TextStyle(fontSize: 32)),
        title:
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: enabled ? onTap : null,
      ),
    );
  }
}

/// 스케줄러가 notifications 배열에 삽입한 알림 목록
class _NotificationScreen extends StatelessWidget {
  final String classId;
  const _NotificationScreen({required this.classId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('알림')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: FirestoreService.instance.watchStudentDoc(classId),
        builder: (context, snap) {
          final items = List<Map<String, dynamic>>.from(
              snap.data?.data()?['notifications'] ?? [])
            ..sort((a, b) => (b['date'] ?? '').compareTo(a['date'] ?? ''));
          if (items.isEmpty) {
            return const Center(child: Text('알림이 없어요 🎉'));
          }
          return ListView.builder(
            itemCount: items.length,
            itemBuilder: (context, i) {
              final n = MissionNotification.fromMap(items[i]);
              return ListTile(
                leading: Text(
                  switch (n.type) {
                    'math' => '📐',
                    'writing' => '✍️',
                    'selfCheck' => '✅',
                    _ => '😊',
                  },
                  style: const TextStyle(fontSize: 28),
                ),
                title: Text(n.message),
                subtitle: Text(n.date),
              );
            },
          );
        },
      ),
    );
  }
}
