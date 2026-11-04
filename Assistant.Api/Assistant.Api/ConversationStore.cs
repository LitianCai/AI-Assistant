using System.Collections.Concurrent;

namespace Assistant.Api;

internal sealed record StoredMessage(string Role, string Text, string? Source);

internal sealed class ConversationStore(TimeProvider time)
{
    // [ASSUMED/TO-REVIEW] Threads live in process memory, partitioned by tenant, and are lost on restart.
    private static readonly TimeSpan Retention = TimeSpan.FromDays(7);
    private readonly ConcurrentDictionary<string, ThreadState> _threads = new(StringComparer.Ordinal);

    internal IReadOnlyList<StoredMessage> Read(string tenantId, string subject)
    {
        var key = Key(tenantId, subject);
        if (!_threads.TryGetValue(key, out var state))
        {
            return [];
        }

        lock (state.Gate)
        {
            if (IsExpired(state))
            {
                _threads.TryRemove(key, out _);
                return [];
            }

            return state.Messages.ToArray();
        }
    }

    internal void Append(string tenantId, string subject, string userText, string assistantText, string? source)
    {
        var key = Key(tenantId, subject);
        var state = _threads.GetOrAdd(key, _ => new ThreadState());
        lock (state.Gate)
        {
            if (IsExpired(state))
            {
                state.Messages.Clear();
            }

            state.Messages.Add(new StoredMessage("user", userText, null));
            state.Messages.Add(new StoredMessage("assistant", assistantText, source));
            state.LastMessageAt = time.GetUtcNow();
            // [ASSUMED] A thread keeps at most the latest 40 messages.
            while (state.Messages.Count > 40)
            {
                state.Messages.RemoveAt(0);
            }
        }
    }

    private bool IsExpired(ThreadState state) =>
        state.LastMessageAt is not null && time.GetUtcNow() >= state.LastMessageAt.Value.Add(Retention);

    private static string Key(string tenantId, string subject) => tenantId + "\n" + subject;

    private sealed class ThreadState
    {
        internal object Gate { get; } = new();
        internal List<StoredMessage> Messages { get; } = [];
        internal DateTimeOffset? LastMessageAt { get; set; }
    }
}
