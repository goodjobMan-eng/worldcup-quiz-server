import 'package:flutter/material.dart';

/// 전개도의 선분 하나. type 0 = 실선(자르기), type 1 = 점선(접기)
class NetLine {
  final Offset p1;
  final Offset p2;
  final int type;

  const NetLine(this.p1, this.p2, this.type);

  /// 방향(그린 순서)에 상관없이 비교할 수 있도록 "작은 끝점 우선"으로 정규화
  String get normalizedKey {
    final first = p1.dx < p2.dx || (p1.dx == p2.dx && p1.dy <= p2.dy);
    final a = first ? p1 : p2;
    final b = first ? p2 : p1;
    return '${a.dx.toInt()},${a.dy.toInt()}-${b.dx.toInt()},${b.dy.toInt()}:$type';
  }

  Map<String, dynamic> toJson() => {
        'x1': p1.dx.toInt(),
        'y1': p1.dy.toInt(),
        'x2': p2.dx.toInt(),
        'y2': p2.dy.toInt(),
        'type': type,
      };

  factory NetLine.fromJson(Map<String, dynamic> json) => NetLine(
        Offset((json['x1'] as num).toDouble(), (json['y1'] as num).toDouble()),
        Offset((json['x2'] as num).toDouble(), (json['y2'] as num).toDouble()),
        json['type'] as int,
      );
}

/// 직육면체 전개도 그리기 보드 (모눈종이 + 실시간 자동 채점)
///
/// - 30px 모눈 단위로 스냅 보정
/// - 실선(자르기) / 점선(접기) 두 가지 펜 모드
/// - 되돌리기 / 전체 지우기
/// - 별도 제출 버튼 없음: 선을 그을 때마다 userLines와 answerLines를
///   실시간 비교하여, 방향·순서 무관하게 모두 일치하면 즉시 [onCorrect] 호출
class NetDrawingBoard extends StatefulWidget {
  final List<NetLine> answerLines;
  final void Function(List<NetLine> userLines) onCorrect;
  final double gridSize;

  const NetDrawingBoard({
    super.key,
    required this.answerLines,
    required this.onCorrect,
    this.gridSize = 30.0,
  });

  @override
  State<NetDrawingBoard> createState() => _NetDrawingBoardState();
}

class _NetDrawingBoardState extends State<NetDrawingBoard> {
  final List<NetLine> _userLines = [];
  int _penType = 0; // 0: 실선(자르기), 1: 점선(접기)
  Offset? _dragStart;
  Offset? _dragCurrent;
  bool _solved = false;

  /// 좌표를 30px 모눈 교차점으로 스냅 보정
  Offset _snap(Offset raw) {
    final g = widget.gridSize;
    return Offset(
      (raw.dx / g).round() * g,
      (raw.dy / g).round() * g,
    );
  }

  void _onPanStart(DragStartDetails d) {
    if (_solved) return;
    setState(() {
      _dragStart = _snap(d.localPosition);
      _dragCurrent = _dragStart;
    });
  }

  void _onPanUpdate(DragUpdateDetails d) {
    if (_solved || _dragStart == null) return;
    setState(() => _dragCurrent = _snap(d.localPosition));
  }

  void _onPanEnd(DragEndDetails d) {
    if (_solved || _dragStart == null || _dragCurrent == null) return;
    final line = NetLine(_dragStart!, _dragCurrent!, _penType);
    setState(() {
      _dragStart = null;
      _dragCurrent = null;
      // 길이 0(같은 점) 또는 중복 선은 무시
      if (line.p1 == line.p2) return;
      if (_userLines.any((l) => l.normalizedKey == line.normalizedKey)) return;
      _userLines.add(line);
    });
    _autoGrade();
  }

  /// 실시간 자동 채점: 정답 선이 모두 있고 오답 선이 하나도 없으면 즉시 정답
  void _autoGrade() {
    final userKeys = _userLines.map((l) => l.normalizedKey).toSet();
    final answerKeys = widget.answerLines.map((l) => l.normalizedKey).toSet();
    if (userKeys.length == answerKeys.length &&
        userKeys.containsAll(answerKeys)) {
      setState(() => _solved = true);
      widget.onCorrect(List.unmodifiable(_userLines));
    }
  }

  void _undo() {
    if (_userLines.isEmpty || _solved) return;
    setState(() => _userLines.removeLast());
  }

  void _clearAll() {
    if (_solved) return;
    setState(() => _userLines.clear());
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildToolbar(),
        const SizedBox(height: 8),
        Expanded(
          child: ClipRect(
            child: GestureDetector(
              onPanStart: _onPanStart,
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
              child: CustomPaint(
                painter: _NetPainter(
                  gridSize: widget.gridSize,
                  lines: _userLines,
                  previewStart: _dragStart,
                  previewEnd: _dragCurrent,
                  previewType: _penType,
                  solved: _solved,
                ),
                child: const SizedBox.expand(),
              ),
            ),
          ),
        ),
        if (_solved)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            color: Colors.green.shade100,
            child: const Text(
              '🎉 정답입니다! 전개도를 완벽하게 그렸어요!',
              textAlign: TextAlign.center,
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ),
      ],
    );
  }

  Widget _buildToolbar() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SegmentedButton<int>(
          segments: const [
            ButtonSegment(
              value: 0,
              icon: Icon(Icons.horizontal_rule),
              label: Text('실선 (자르기)'),
            ),
            ButtonSegment(
              value: 1,
              icon: Icon(Icons.more_horiz),
              label: Text('점선 (접기)'),
            ),
          ],
          selected: {_penType},
          onSelectionChanged: (s) => setState(() => _penType = s.first),
        ),
        const SizedBox(width: 12),
        IconButton(
          tooltip: '되돌리기',
          icon: const Icon(Icons.undo),
          onPressed: _undo,
        ),
        IconButton(
          tooltip: '전체 지우기',
          icon: const Icon(Icons.delete_outline),
          onPressed: _clearAll,
        ),
      ],
    );
  }
}

class _NetPainter extends CustomPainter {
  final double gridSize;
  final List<NetLine> lines;
  final Offset? previewStart;
  final Offset? previewEnd;
  final int previewType;
  final bool solved;

  _NetPainter({
    required this.gridSize,
    required this.lines,
    required this.previewStart,
    required this.previewEnd,
    required this.previewType,
    required this.solved,
  });

  @override
  void paint(Canvas canvas, Size size) {
    _drawGrid(canvas, size);
    for (final line in lines) {
      _drawLine(canvas, line.p1, line.p2, line.type,
          solved ? Colors.green : Colors.indigo);
    }
    if (previewStart != null &&
        previewEnd != null &&
        previewStart != previewEnd) {
      _drawLine(canvas, previewStart!, previewEnd!, previewType,
          Colors.indigo.withOpacity(0.4));
    }
  }

  void _drawGrid(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey.shade300
      ..strokeWidth = 1;
    for (double x = 0; x <= size.width; x += gridSize) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y <= size.height; y += gridSize) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  void _drawLine(Canvas canvas, Offset p1, Offset p2, int type, Color color) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    if (type == 0) {
      canvas.drawLine(p1, p2, paint); // 실선
    } else {
      // 점선: 선분을 따라 6px 대시 + 5px 간격
      const dash = 6.0, gap = 5.0;
      final total = (p2 - p1).distance;
      final dir = (p2 - p1) / total;
      double covered = 0;
      while (covered < total) {
        final end = (covered + dash).clamp(0, total).toDouble();
        canvas.drawLine(p1 + dir * covered, p1 + dir * end, paint);
        covered += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_NetPainter old) =>
      old.lines.length != lines.length ||
      old.previewEnd != previewEnd ||
      old.solved != solved;
}
