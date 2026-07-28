MOD = 10009

n = int(input())

a, b = 1, 1  # 1번째, 2번째 피보나치 수
for _ in range(n - 1):
    a, b = b, (a + b) % MOD

print(a)
