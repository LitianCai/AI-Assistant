namespace NorthlineSupply.Api;

// [ASSUMED] The year 2026 and USD are demo display choices for sample prices.
internal static class DemoData
{
    private static readonly CatalogItem[] CatalogItems =
    [
        new("NL-4402", "Brass ball valve", "Brass", "1/2 in", "600 psi", 24.50m, 120, 8, ["NL-7704"]),
        new("NL-4408", "Brass ball valve", "Brass", "1 in", "600 psi", 41.00m, 36, 0, []),
        new("NL-5510", "Stainless nipple", "Stainless", "1/2 in", null, 6.75m, 0, 20, []),
        new("NL-6621", "PTFE thread tape", "PTFE", "1/2 in", null, 3.20m, 240, 0, []),
        new("NL-7704", "Carbon steel coupling", "Carbon steel", "3/4 in", "3000 psi", 18.90m, 54, 4, []),
    ];

    private static readonly OrderDetail[] Orders =
    [
        Order(10482, new DateOnly(2026, 10, 21), "Partially shipped", new DateOnly(2026, 10, 28),
        [
            Line("NL-4402", 10, "Shipped", null),
            Line("NL-4408", 4, "Shipped", null),
            Line("NL-5510", 20, "Open", new DateOnly(2026, 11, 12)),
            Line("NL-6621", 12, "Open", new DateOnly(2026, 11, 6)),
        ]),
        Order(10471, new DateOnly(2026, 10, 2), "Shipped", new DateOnly(2026, 10, 14),
        [
            Line("NL-4402", 8, "Shipped", null),
            Line("NL-7704", 6, "Shipped", null),
        ]),
        Order(10390, new DateOnly(2026, 8, 20), "Shipped", new DateOnly(2026, 9, 2),
        [
            Line("NL-6621", 24, "Shipped", null),
        ]),
    ];

    private static readonly Invoice[] Invoices =
    [
        new("INV-8831", 10482, new DateOnly(2026, 10, 28), "Open", 409.00m, 409.00m),
        new("INV-8790", 10471, new DateOnly(2026, 10, 14), "Paid", 309.40m, 0m),
        new("INV-8602", 10390, new DateOnly(2026, 9, 2), "Paid", 76.80m, 0m),
    ];

    internal static IReadOnlyList<OrderSummary> OrdersFor(DemoSession session) =>
        Owns(session) ? Orders.Select(Summary).ToArray() : [];

    internal static OrderDetail? OrderFor(DemoSession session, int orderNumber) =>
        Owns(session) ? Orders.FirstOrDefault(order => order.OrderNumber == orderNumber) : null;

    internal static IReadOnlyList<Invoice> InvoicesFor(DemoSession session) =>
        Owns(session) ? Invoices : [];

    internal static IReadOnlyList<CatalogItem> CatalogFor(DemoSession session, string? q)
    {
        if (!Owns(session))
        {
            return [];
        }

        if (string.IsNullOrEmpty(q))
        {
            return CatalogItems;
        }

        return CatalogItems.Where(item =>
                item.Sku.Contains(q, StringComparison.OrdinalIgnoreCase)
                || item.Name.Contains(q, StringComparison.OrdinalIgnoreCase)
                || item.Material.Contains(q, StringComparison.OrdinalIgnoreCase)
                || item.Size.Contains(q, StringComparison.OrdinalIgnoreCase))
            .ToArray();
    }

    private static bool Owns(DemoSession session) =>
        session.AccountNumber == DemoAccount.AccountNumber;

    private static OrderLine Line(string sku, int quantity, string status, DateOnly? promiseDate)
    {
        var item = CatalogItems.First(entry => entry.Sku == sku);
        return new OrderLine(
            item.Sku,
            item.Name,
            item.Material,
            item.Size,
            quantity,
            status,
            promiseDate,
            item.UnitPrice,
            item.Available,
            item.Allocated);
    }

    private static OrderDetail Order(
        int orderNumber,
        DateOnly placedOn,
        string status,
        DateOnly? shippedOn,
        OrderLine[] lines) =>
        new(
            orderNumber,
            placedOn,
            status,
            shippedOn,
            lines.Length,
            lines.Count(line => line.Status == "Open"),
            lines);

    private static OrderSummary Summary(OrderDetail order) =>
        new(order.OrderNumber, order.PlacedOn, order.Status, order.ShippedOn, order.LineCount, order.OpenLineCount);
}

internal sealed record CatalogItem(
    string Sku,
    string Name,
    string Material,
    string Size,
    string? Pressure,
    decimal UnitPrice,
    int Available,
    int Allocated,
    string[] Substitutes);

internal sealed record OrderLine(
    string Sku,
    string Name,
    string Material,
    string Size,
    int Quantity,
    string Status,
    DateOnly? PromiseDate,
    decimal UnitPrice,
    int Available,
    int Allocated);

internal sealed record OrderSummary(
    int OrderNumber,
    DateOnly PlacedOn,
    string Status,
    DateOnly? ShippedOn,
    int LineCount,
    int OpenLineCount);

internal sealed record OrderDetail(
    int OrderNumber,
    DateOnly PlacedOn,
    string Status,
    DateOnly? ShippedOn,
    int LineCount,
    int OpenLineCount,
    OrderLine[] Lines);

internal sealed record Invoice(
    string InvoiceNumber,
    int OrderNumber,
    DateOnly BilledOn,
    string Status,
    decimal Total,
    decimal Balance);

internal sealed record AccountResponse(
    string AccountName,
    string AccountNumber,
    string BuyerName,
    bool CreditHold);

internal sealed record OrderListResponse(IReadOnlyList<OrderSummary> Orders);

internal sealed record InvoiceListResponse(IReadOnlyList<Invoice> Invoices);

internal sealed record CatalogResponse(IReadOnlyList<CatalogItem> Items);

internal sealed record HealthResponse(string Status);

internal sealed record SessionResponse(
    string Token,
    string DisplayName,
    string AccountName,
    string AccountNumber);

internal sealed record ApiTitle(string Title);
