namespace Assistant.Api.Tests;

public sealed class RefusalHistoryTests
{
    [Fact]
    public void Refused_exchanges_are_left_out_of_model_history()
    {
        var history = new[]
        {
            new StoredMessage("user", "Q1", null),
            new StoredMessage("assistant", "A1", "Catalog API"),
            new StoredMessage("user", "Q2", null),
            new StoredMessage("assistant", AssistantText.CannotRetrieve, null),
            new StoredMessage("user", "Q3", null),
            new StoredMessage("assistant", "A3", null),
        };

        var kept = AssistantTurn.WithoutRefusals(history);

        Assert.Equal(new[] { "Q1", "A1", "Q3", "A3" }, kept.Select(message => message.Text).ToArray());
    }
}
