namespace Assistant.Api;

internal sealed class CircuitBreaker
{
    // [ASSUMED] Three failures open the circuit for 30 seconds, the same limits as the widget.
    private readonly object _gate = new();
    private int _failures;
    private DateTimeOffset _openUntil;

    internal bool Allow(DateTimeOffset now)
    {
        lock (_gate)
        {
            return now >= _openUntil;
        }
    }

    internal void Succeed()
    {
        lock (_gate)
        {
            _failures = 0;
            _openUntil = default;
        }
    }

    internal void Fail(DateTimeOffset now)
    {
        lock (_gate)
        {
            _failures++;
            if (_failures >= 3)
            {
                _openUntil = now.AddSeconds(30);
                _failures = 0;
            }
        }
    }
}

internal sealed class OutboundBreakers
{
    internal CircuitBreaker Foundry { get; } = new();
    internal CircuitBreaker Northline { get; } = new();
}

internal sealed class OutboundFailedException : Exception
{
    internal OutboundFailedException()
        : base("outbound failed")
    {
    }
}
