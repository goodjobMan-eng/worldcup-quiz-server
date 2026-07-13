import 'package:flutter/material.dart';

/// 30일 글쓰기 연속 제출(Streak) 트래커
///
/// [submittedDays]에 제출 완료된 day 번호(1~30)를 넘기면
/// 30칸 그리드로 달성도를 시각화하고 현재 연속 기록을 계산해 보여준다.
class StreakTracker extends StatelessWidget {
  final Set<int> submittedDays;
  final int currentDay; // 오늘이 며칠차인지 (1~30)

  const StreakTracker({
    super.key,
    required this.submittedDays,
    required this.currentDay,
  });

  /// 오늘(또는 어제)부터 거꾸로 세어 현재 연속 제출 일수 계산
  int get _streak {
    var day = submittedDays.contains(currentDay) ? currentDay : currentDay - 1;
    var count = 0;
    while (day >= 1 && submittedDays.contains(day)) {
      count++;
      day--;
    }
    return count;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('🔥', style: TextStyle(fontSize: 28)),
                const SizedBox(width: 8),
                Text('연속 $_streak일 달성!',
                    style: Theme.of(context).textTheme.titleLarge),
                const Spacer(),
                Text('${submittedDays.length}/30',
                    style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 10,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              children: List.generate(30, (i) {
                final day = i + 1;
                final done = submittedDays.contains(day);
                final isToday = day == currentDay;
                return Container(
                  decoration: BoxDecoration(
                    color: done
                        ? Colors.orange
                        : (day < currentDay
                            ? Colors.grey.shade300
                            : Colors.grey.shade100),
                    borderRadius: BorderRadius.circular(6),
                    border: isToday
                        ? Border.all(color: Colors.deepOrange, width: 2)
                        : null,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    done ? '✓' : '$day',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: done ? Colors.white : Colors.grey.shade600,
                    ),
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }
}
