import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'models/models.dart';
import 'screens/auth/join_class_screen.dart';
import 'screens/student/emotion_checkin_screen.dart';
import 'screens/student/student_home_screen.dart';
import 'screens/teacher/teacher_dashboard_screen.dart';
import 'services/firestore_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // FlutterFire CLI로 생성한 firebase_options.dart의 옵션을 사용하세요:
  //   await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await Firebase.initializeApp();
  runApp(const MajiHomeworkApp());
}

class MajiHomeworkApp extends StatelessWidget {
  const MajiHomeworkApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '마지초 방학숙제',
      theme: ThemeData(
        colorSchemeSeed: Colors.indigo,
        useMaterial3: true,
        fontFamily: 'Pretendard',
      ),
      home: const AuthGate(),
    );
  }
}

/// 로그인 → 역할/소속에 따라 화면 분기
///  - 미로그인: 익명 로그인 후 학급 참여 코드 입력
///  - 학생: 감정 체크인(최초 접속) → 학생 홈
///  - 교사: 학급 대시보드
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, authSnap) {
        if (authSnap.connectionState == ConnectionState.waiting) {
          return const _Loading();
        }
        if (authSnap.data == null) {
          return const JoinClassScreen();
        }
        return StreamBuilder<AppUser>(
          stream: FirestoreService.instance.watchMe(),
          builder: (context, userSnap) {
            final user = userSnap.data;
            if (user == null) return const _Loading();
            if (user.classId == null) return const JoinClassScreen();
            if (user.isTeacher) {
              return TeacherDashboardScreen(classId: user.classId!);
            }
            return EmotionCheckInGate(user: user);
          },
        );
      },
    );
  }
}

/// 앱 최초 접속 시 오늘 감정 체크인을 먼저 요구하는 게이트
class EmotionCheckInGate extends StatelessWidget {
  final AppUser user;
  const EmotionCheckInGate({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: FirestoreService.instance.hasCheckedInToday(user.classId!),
      builder: (context, snap) {
        if (!snap.hasData) return const _Loading();
        if (snap.data == false) {
          return EmotionCheckInScreen(classId: user.classId!);
        }
        return StudentHomeScreen(user: user);
      },
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}
