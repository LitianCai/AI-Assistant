namespace SouthlineSupply.Api;

// [ASSUMED] The year 2026 and USD are demo display choices for sample prices.
internal static class DemoData
{
    private static readonly CatalogItem[] CatalogItems =
    [
        new("SL-1108", "Copper bus bar", "Copper", "1/4 in x 2 in", null, 86.00m, 40, 2, ["SL-2214"]),
        new("SL-2214", "Galvanized strut channel", "Galvanized steel", "1-5/8 in", null, 19.25m, 180, 0, []),
        new("SL-3340", "PVC conduit elbow", "PVC", "1 in", null, 4.40m, 0, 12, []),
        new("SL-4488", "Aluminum cable tray", "Aluminum", "12 in", null, 132.00m, 16, 3, []),
        new("SL-5520", "Zinc grounding clamp", "Zinc", "1/2 in", null, 11.60m, 90, 0, []),
    ];

    private static readonly OrderDetail[] Orders =
    [
        Order(22017, new DateOnly(2026, 9, 15), "Partially shipped", new DateOnly(2026, 9, 22),
        [
            Line("SL-1108", 6, "Shipped", null),
            Line("SL-2214", 14, "Shipped", null),
            Line("SL-3340", 40, "Shipped", null),
            Line("SL-5520", 25, "Shipped", null),
            Line("SL-4488", 3, "Open", new DateOnly(2026, 11, 18)),
        ]),
        Order(21940, new DateOnly(2026, 7, 11), "Shipped", new DateOnly(2026, 7, 20),
        [
            Line("SL-2214", 8, "Shipped", null),
            Line("SL-5520", 16, "Shipped", null),
        ]),
        Order(21703, new DateOnly(2026, 5, 4), "Shipped", new DateOnly(2026, 5, 19),
        [
            Line("SL-3340", 100, "Shipped", null),
        ]),
    ];

    private static readonly Invoice[] Invoices =
    [
        new("INV-4410", 22017, new DateOnly(2026, 9, 22), "Open", 1284.50m, 1284.50m),
        new("INV-4366", 21940, new DateOnly(2026, 7, 20), "Paid", 512.75m, 0m),
        new("INV-4288", 21703, new DateOnly(2026, 5, 19), "Paid", 440.00m, 0m),
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
