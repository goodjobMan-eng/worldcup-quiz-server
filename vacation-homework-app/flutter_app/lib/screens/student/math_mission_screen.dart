import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/firestore_service.dart';
import '../../widgets/net_drawing_board.dart';

/// 오늘의 수학 미션 화면
/// - 일반 문제(객관식/단답형)는 답안을 모으고,
/// - 전개도 문제(netDrawing)는 NetDrawingBoard가 실시간 자동 채점.
/// - 모든 문제가 풀리면 gradeMathDay callable로 서버 채점 → isCompleted 확정
class MathMissionScreen extends StatefulWidget {
  final int day;
  const MathMissionScreen({super.key, required this.day});

  @override
  State<MathMissionScreen> createState() => _MathMissionScreenState();
}

class _MathMissionScreenState extends State<MathMissionScreen> {
  final _answers = <String, String>{};
  final _netLines = <String, List<NetLine>>{};
  final _solvedNets = <String>{};
  bool _submitting = false;

  Future<void> _submit(MathDay mathDay) async {
    setState(() => _submitting = true);
    try {
      final completed = await FirestoreService.instance.submitMathDay(
        day: widget.day,
        answers: _answers,
        netLines: _netLines,
      );
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(completed ? '🎉 오늘의 수학 완료!' : '조금만 더!'),
          content: Text(completed
              ? '모든 문제를 맞혔어요. 정말 대단해요!'
              : '틀린 문제가 있어요. 다시 한번 도전해 볼까요?'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                if (completed) Navigator.pop(this.context);
              },
              child: const Text('확인'),
            ),
          ],
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MathDay?>(
      future: FirestoreService.instance.getMathDay(widget.day),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final mathDay = snap.data;
        if (mathDay == null) {
          return Scaffold(
            appBar: AppBar(title: Text('${widget.day}일차 수학')),
            body: const Center(child: Text('오늘 문제가 아직 등록되지 않았어요.')),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: Text('${mathDay.day}일차 · ${mathDay.unit}'),
          ),
          body: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: mathDay.problems.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              if (i == mathDay.problems.length) {
                return FilledButton(
                  onPressed: _submitting ? null : () => _submit(mathDay),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(_submitting ? '채점 중...' : '제출하고 채점받기'),
                  ),
                );
              }
              final p = mathDay.problems[i];
              return _ProblemCard(
                index: i + 1,
                problem: p,
                answer: _answers[p.id],
                netSolved: _solvedNets.contains(p.id),
                onAnswer: (v) => setState(() => _answers[p.id] = v),
                onNetCorrect: (lines) => setState(() {
                  _netLines[p.id] = lines;
                  _solvedNets.add(p.id);
                }),
              );
            },
          ),
        );
      },
    );
  }
}

class _ProblemCard extends StatelessWidget {
  final int index;
  final MathProblem problem;
  final String? answer;
  final bool netSolved;
  final ValueChanged<String> onAnswer;
  final void Function(List<NetLine>) onNetCorrect;

  const _ProblemCard({
    required this.index,
    required this.problem,
    required this.answer,
    required this.netSolved,
    required this.onAnswer,
    required this.onNetCorrect,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('문제 $index',
                style: Theme.of(context)
                    .textTheme
                    .labelLarge
                    ?.copyWith(color: Colors.indigo)),
            const SizedBox(height: 8),
            Text(problem.question,
                style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 12),
            switch (problem.kind) {
              'multipleChoice' => Column(
                  children: problem.choices
                      .map((c) => RadioListTile<String>(
                            title: Text(c),
                            value: c,
                            groupValue: answer,
                            onChanged: (v) => onAnswer(v!),
                          ))
                      .toList(),
                ),
              'shortAnswer' => TextField(
                  decoration: const InputDecoration(
                    labelText: '답',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: onAnswer,
                ),
              'netDrawing' => SizedBox(
                  height: 360,
                  child: NetDrawingBoard(
                    answerLines: problem.answerLines
                        .map(NetLine.fromJson)
                        .toList(),
                    onCorrect: onNetCorrect,
                  ),
                ),
              _ => const SizedBox.shrink(),
            },
          ],
        ),
      ),
    );
  }
}
