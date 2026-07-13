import 'package:flutter/material.dart';

import '../../services/firestore_service.dart';

/// 일일 감정 체크인 — 앱 최초 접속 시 표시
/// 결과는 학생 본인과 담당 선생님 대시보드에서만 볼 수 있다.
class EmotionCheckInScreen extends StatefulWidget {
  final String classId;
  const EmotionCheckInScreen({super.key, required this.classId});

  @override
  State<EmotionCheckInScreen> createState() => _EmotionCheckInScreenState();
}

class _EmotionCheckInScreenState extends State<EmotionCheckInScreen> {
  static const _emojis = ['😀', '🙂', '😐', '😢', '😡', '😴', '🤩'];
  String? _selected;
  final _commentController = TextEditingController();
  bool _busy = false;

  Future<void> _submit() async {
    if (_selected == null) return;
    setState(() => _busy = true);
    await FirestoreService.instance.checkInEmotion(
      widget.classId,
      _selected!,
      _commentController.text.trim(),
    );
    if (mounted) {
      // AuthGate가 다시 빌드되며 홈으로 이동하도록 pushReplacement 대신
      // 최상위에서 재평가되게 한다.
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const _CheckedIn()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              Text('오늘 기분은 어때요?',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              const Text('선택한 감정은 선생님만 볼 수 있어요.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 32),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 12,
                runSpacing: 12,
                children: _emojis.map((e) {
                  final selected = _selected == e;
                  return GestureDetector(
                    onTap: () => setState(() => _selected = e),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: selected
                            ? Colors.indigo.shade100
                            : Colors.grey.shade100,
                        shape: BoxShape.circle,
                        border: selected
                            ? Border.all(color: Colors.indigo, width: 3)
                            : null,
                      ),
                      child: Text(e, style: const TextStyle(fontSize: 36)),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _commentController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: '하고 싶은 말 (선택)',
                  hintText: '오늘 있었던 일이나 기분을 자유롭게 적어 보세요.',
                  border: OutlineInputBorder(),
                ),
              ),
              const Spacer(),
              SizedBox(
                height: 52,
                child: FilledButton(
                  onPressed: _selected == null || _busy ? null : _submit,
                  child: const Text('체크인 완료', style: TextStyle(fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 체크인 직후 AuthGate를 다시 타도록 하는 브리지 화면
class _CheckedIn extends StatelessWidget {
  const _CheckedIn();
  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Navigator.of(context).pushNamedAndRemoveUntil('/', (r) => false);
    });
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
