namespace Assistant.Api;

internal sealed record AuditEntry(
    DateTimeOffset At,
    string TenantId,
    string Actor,
    string Action,
    string Target,
    string Outcome,
    int Milliseconds);

internal sealed class AuditLog
{
    // [ASSUMED/TO-REVIEW] Audit entries live in process memory and are lost on restart.
    private readonly List<AuditEntry> _entries = [];

    internal void Append(DateTimeOffset at, AccessToken actor, string action, string target, string outcome, int milliseconds)
    {
        var entry = new AuditEntry(at, actor.TenantId, actor.Subject, action, target, outcome, milliseconds);
        lock (_entries)
        {
            _entries.Add(entry);
        }
    }

    internal IReadOnlyList<AuditEntry> Entries
    {
        get
        {
            lock (_entries)
            {
                return _entries.ToArray();
            }
        }
    }
}
