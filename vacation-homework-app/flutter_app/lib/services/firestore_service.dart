import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/models.dart';
import '../widgets/net_drawing_board.dart';

/// Firestore / Cloud Functions 접근을 한곳에 모은 서비스 레이어
class FirestoreService {
  FirestoreService._();
  static final instance = FirestoreService._();

  final _db = FirebaseFirestore.instance;
  final _functions =
      FirebaseFunctions.instanceFor(region: 'asia-northeast3');

  String get uid => FirebaseAuth.instance.currentUser!.uid;

  String dateKey([DateTime? d]) {
    final t = d ?? DateTime.now();
    return '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}';
  }

  String dayId(int day) => 'day${day.toString().padLeft(2, '0')}';

  // ---------- 사용자 / 학급 ----------
  Stream<AppUser> watchMe() =>
      _db.doc('users/$uid').snapshots().map(AppUser.fromDoc);

  Future<SchoolClass> getClass(String classId) async =>
      SchoolClass.fromDoc(await _db.doc('classes/$classId').get());

  /// 학급 참여 코드로 가입 (서버 검증 — joinClass callable)
  Future<void> joinClassWithCode(String code, String name) async {
    await _functions
        .httpsCallable('joinClass')
        .call({'code': code, 'name': name});
  }

  /// 학급 내 학생 문서 스트림 (알림 목록 등)
  Stream<DocumentSnapshot<Map<String, dynamic>>> watchStudentDoc(
          String classId) =>
      _db.doc('classes/$classId/students/$uid').snapshots();

  // ---------- 공유 콘텐츠 ----------
  Future<MathDay?> getMathDay(int day) async {
    final doc = await _db.doc('mathBank/${dayId(day)}').get();
    return doc.exists ? MathDay.fromDoc(doc) : null;
  }

  Future<WritingTopic?> getWritingTopic(int day) async {
    final doc = await _db.doc('writingTopics/${dayId(day)}').get();
    return doc.exists ? WritingTopic.fromDoc(doc) : null;
  }

  // ---------- 학생 미션 제출 ----------
  /// 수학 답안 제출 → 서버가 채점하고 isCompleted 확정
  Future<bool> submitMathDay({
    required int day,
    required Map<String, String> answers,
    required Map<String, List<NetLine>> netLines,
  }) async {
    final result = await _functions.httpsCallable('gradeMathDay').call({
      'dayId': dayId(day),
      'answers': answers,
      'netLines': netLines.map(
          (k, v) => MapEntry(k, v.map((l) => l.toJson()).toList())),
    });
    return result.data['isCompleted'] == true;
  }

  /// 글쓰기 제출 → 서버 타임스탬프로 확정
  Future<void> submitWriting(int day, String content) async {
    await _functions
        .httpsCallable('submitWriting')
        .call({'dayId': dayId(day), 'content': content});
  }

  /// 감정 체크인 (오늘 최초 접속 시)
  Future<void> checkInEmotion(
      String classId, String emoji, String comment) async {
    await _db
        .doc('classes/$classId/students/$uid/emotions/${dateKey()}')
        .set({
      'emoji': emoji,
      'comment': comment,
      'createdAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Future<bool> hasCheckedInToday(String classId) async {
    final doc = await _db
        .doc('classes/$classId/students/$uid/emotions/${dateKey()}')
        .get();
    return doc.exists;
  }

  /// 제출 완료한 글쓰기 day 번호 집합 (Streak 트래커용)
  Stream<Set<int>> watchSubmittedWritingDays(String classId) => _db
      .collection('classes/$classId/students/$uid/writingSubmissions')
      .where('isSubmitted', isEqualTo: true)
      .snapshots()
      .map((s) => s.docs
          .map((d) => int.tryParse(d.id.replaceFirst('day', '')) ?? 0)
          .where((n) => n > 0)
          .toSet());

  // ---------- 교사 대시보드 ----------
  /// 학급 학생 전체의 당일 미션 현황을 한 번에 조회
  Future<List<Map<String, dynamic>>> fetchDailyStatus(
      String classId, int missionDay) async {
    final students =
        await _db.collection('classes/$classId/students').get();
    final today = dateKey();

    return Future.wait(students.docs.map((s) async {
      final base = 'classes/$classId/students/${s.id}';
      final results = await Future.wait([
        _db.doc('$base/mathProgress/${dayId(missionDay)}').get(),
        _db.doc('$base/writingSubmissions/${dayId(missionDay)}').get(),
        _db.doc('$base/selfChecks/$today').get(),
        _db.doc('$base/emotions/$today').get(),
      ]);
      return {
        'uid': s.id,
        'name': s.data()['name'],
        'math': results[0].data()?['isCompleted'] == true,
        'writing': results[1].data()?['isSubmitted'] == true,
        'selfCheck': results[2].data()?['allDone'] == true,
        'emotionEmoji': results[3].data()?['emoji'],
        'emotionComment': results[3].data()?['comment'],
      };
    }));
  }
}
