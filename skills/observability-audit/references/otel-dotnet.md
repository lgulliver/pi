# OpenTelemetry in .NET (reference setup)

The standard wiring for an ASP.NET Core service on .NET 10. Use this when adding or
reviewing OTel in a .NET service.

## Packages

```xml
<ItemGroup>
  <PackageReference Include="OpenTelemetry.Extensions.Hosting" />
  <PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" />
  <PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" />
  <PackageReference Include="OpenTelemetry.Instrumentation.Http" />
  <PackageReference Include="OpenTelemetry.Instrumentation.Runtime" />
</ItemGroup>
```

## Program.cs

Resource attributes match the taxonomy; custom sources are registered explicitly;
logs include scopes for trace correlation.

```csharp
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

void ConfigureResource(ResourceBuilder r) => r
    .AddService(
        serviceName: "ccaas-dialler-api",
        serviceNamespace: "ccaas",
        serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString())
    .AddAttributes(new Dictionary<string, object>
    {
        ["deployment.environment.name"] = builder.Environment.EnvironmentName.ToLowerInvariant()
    });

builder.Services.AddOpenTelemetry()
    .ConfigureResource(ConfigureResource)
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation(o => o.RecordException = true)
        .AddHttpClientInstrumentation()
        .AddSource("Acme.Dialler")               // custom ActivitySource
        .AddOtlpExporter())                     // endpoint/protocol from OTEL_* env vars
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddMeter("Acme.Dialler")               // custom Meter
        .AddOtlpExporter());

builder.Logging.AddOpenTelemetry(o =>
{
    var rb = ResourceBuilder.CreateDefault(); ConfigureResource(rb);
    o.SetResourceBuilder(rb);
    o.IncludeScopes = true;        // carries trace_id / span_id
    o.ParseStateValues = true;     // structured fields, not interpolated strings
    o.AddOtlpExporter();
});
```

## Custom business telemetry

Named per the metric rules; high-cardinality IDs on the span, bounded labels on the
metric.

```csharp
using System.Diagnostics;
using System.Diagnostics.Metrics;

public static class DiallerTelemetry
{
    public static readonly ActivitySource ActivitySource = new("Acme.Dialler");
    private static readonly Meter Meter = new("Acme.Dialler");

    public static readonly Counter<long> CallsConnected =
        Meter.CreateCounter<long>("calls_connected_total", description: "Outbound calls connected");
    public static readonly Histogram<double> DialDuration =
        Meter.CreateHistogram<double>("dial_attempt_duration_seconds", unit: "s");
}

// usage
using var activity = DiallerTelemetry.ActivitySource.StartActivity("dial_attempt");
activity?.SetTag("org.call_id", callId);                        // high-cardinality -> span
DiallerTelemetry.CallsConnected.Add(1,
    new("queue", queueName), new("direction", "outbound"));     // bounded labels only
```

## Export destination is config, not code

The OTLP exporter reads the standard env vars, so nothing about the backend is
hard-coded. Send to a **local Alloy/collector**, not direct to Grafana Cloud — the
collector owns batching, retries, redaction, filtering, tail sampling and routing.

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317   # local Alloy agent
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
```

Direct-to-cloud is an exception (isolated tooling, one-off jobs) and needs platform
sign-off because it bypasses Alloy's redaction and tail sampling. If you must, the
token is a credential — inject it from the secret store, never appsettings or source
control.

## Profiling (Pyroscope)

For CPU/memory-sensitive services, enable the Pyroscope .NET profiler (via the
profiler env vars / base image), labelled by service and version. Low overhead
(~2–5%), so default it on for performance-critical services. Shares resource
attributes so you can pivot metric → trace → profile.
