import 'package:cloud_firestore/cloud_firestore.dart';

/// 사용자 (users/{uid})
class AppUser {
  final String uid;
  final String role; // 'teacher' | 'student'
  final String name;
  final String? classId;
  final bool approved;

  const AppUser({
    required this.uid,
    required this.role,
    required this.name,
    this.classId,
    this.approved = false,
  });

  bool get isTeacher => role == 'teacher';

  factory AppUser.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return AppUser(
      uid: doc.id,
      role: d['role'] ?? 'student',
      name: d['name'] ?? '',
      classId: d['classId'],
      approved: d['approved'] ?? false,
    );
  }
}

/// 학급 (classes/{classId})
class SchoolClass {
  final String id;
  final String name;
  final String teacherId;
  final String joinCode;
  final bool isActive;
  final DateTime missionStartDate;

  const SchoolClass({
    required this.id,
    required this.name,
    required this.teacherId,
    required this.joinCode,
    required this.isActive,
    required this.missionStartDate,
  });

  /// 오늘이 미션 며칠차인지 (1일차 미만이면 0)
  int get currentMissionDay {
    final diff = DateTime.now().difference(missionStartDate).inDays + 1;
    return diff < 1 ? 0 : diff;
  }

  factory SchoolClass.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return SchoolClass(
      id: doc.id,
      name: d['name'] ?? '',
      teacherId: d['teacherId'] ?? '',
      joinCode: d['joinCode'] ?? '',
      isActive: d['isActive'] ?? true,
      missionStartDate:
          DateTime.tryParse(d['missionStartDate'] ?? '') ?? DateTime.now(),
    );
  }
}

/// 수학 문제 (mathBank/{dayId}.problems[])
class MathProblem {
  final String id;
  final String kind; // 'multipleChoice' | 'shortAnswer' | 'netDrawing'
  final String question;
  final List<String> choices;
  final String? answer;
  final List<Map<String, dynamic>> answerLines; // netDrawing 정답 선분

  const MathProblem({
    required this.id,
    required this.kind,
    required this.question,
    this.choices = const [],
    this.answer,
    this.answerLines = const [],
  });

  factory MathProblem.fromMap(Map<String, dynamic> m) => MathProblem(
        id: m['id'],
        kind: m['kind'],
        question: m['question'],
        choices: List<String>.from(m['choices'] ?? []),
        answer: m['answer']?.toString(),
        answerLines: List<Map<String, dynamic>>.from(m['answerLines'] ?? []),
      );
}

/// 하루치 수학 미션 (mathBank/{dayId})
class MathDay {
  final String dayId; // "day01" ~ "day28"
  final int day;
  final String unit;
  final String type; // 'concept' | 'review'
  final List<MathProblem> problems;

  const MathDay({
    required this.dayId,
    required this.day,
    required this.unit,
    required this.type,
    required this.problems,
  });

  factory MathDay.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return MathDay(
      dayId: doc.id,
      day: d['day'] ?? 0,
      unit: d['unit'] ?? '',
      type: d['type'] ?? 'concept',
      problems: List<Map<String, dynamic>>.from(d['problems'] ?? [])
          .map(MathProblem.fromMap)
          .toList(),
    );
  }
}

/// 글쓰기 주제 (writingTopics/{dayId})
class WritingTopic {
  final String dayId;
  final int day;
  final String topic;
  final String guide;

  const WritingTopic({
    required this.dayId,
    required this.day,
    required this.topic,
    required this.guide,
  });

  factory WritingTopic.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    return WritingTopic(
      dayId: doc.id,
      day: d['day'] ?? 0,
      topic: d['topic'] ?? '',
      guide: d['guide'] ?? '',
    );
  }
}

/// 알림 (students/{uid}.notifications[])
class MissionNotification {
  final String id;
  final String type; // math | writing | selfCheck | emotion
  final String message;
  final String date;
  final bool read;

  const MissionNotification({
    required this.id,
    required this.type,
    required this.message,
    required this.date,
    required this.read,
  });

  factory MissionNotification.fromMap(Map<String, dynamic> m) =>
      MissionNotification(
        id: m['id'] ?? '',
        type: m['type'] ?? '',
        message: m['message'] ?? '',
        date: m['date'] ?? '',
        read: m['read'] ?? false,
      );
}
