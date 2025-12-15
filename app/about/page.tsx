import { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "About CleanPlate Chicago | Restaurant Health Inspection Data",
  description: "Learn about CleanPlate Chicago, our mission to make restaurant health inspection data accessible, and how we calculate CleanPlate scores.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">About CleanPlate</h1>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Our Mission</h2>
          <p className="text-default-700 mb-4">
            CleanPlate Chicago transforms 200,000+ public restaurant health inspection records into a consumer-friendly mobile-first web app. We make restaurant health data accessible, understandable, and actionable for every Chicago diner.
          </p>
          <p className="text-default-700">
            Unlike Yelp (which buries inspection data) or defunct competitors, CleanPlate makes safety the primary lens for restaurant discovery.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Data Source</h2>
          <p className="text-default-700 mb-4">
            All inspection data comes from the{" "}
            <a
              href="https://data.cityofchicago.org/Health-Human-Services/Food-Inspections/4ijn-s7e5"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Chicago Data Portal
            </a>
            , which is updated weekly (typically on Fridays). The data is public domain and includes inspection records dating back to 2010.
          </p>
          <p className="text-default-700">
            We sync this data daily to ensure you always have access to the latest inspection results.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">CleanPlate Score</h2>
          <p className="text-default-700 mb-4">
            Our proprietary CleanPlate Score (0-100) combines multiple factors to give you a comprehensive view of a restaurant&apos;s food safety:
          </p>
          <ul className="list-disc list-inside space-y-2 text-default-700 mb-4">
            <li><strong>Result (40%):</strong> Pass, Conditional, or Fail status</li>
            <li><strong>Trend (20%):</strong> Improvement or decline over recent inspections</li>
            <li><strong>Violations (20%):</strong> Number and severity of violations</li>
            <li><strong>Recency (10%):</strong> How recent the last inspection was</li>
            <li><strong>Inspection Category (10%):</strong> Establishment inspection category (Level 1-3)</li>
          </ul>
          <p className="text-default-700">
            Scores are updated automatically when new inspection data is available.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Score Ranges</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-success"></div>
              <span className="text-default-700"><strong>85-100:</strong> Excellent</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-success"></div>
              <span className="text-default-700"><strong>70-84:</strong> Good</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-warning"></div>
              <span className="text-default-700"><strong>50-69:</strong> Fair</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-danger"></div>
              <span className="text-default-700"><strong>0-49:</strong> Poor</span>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Contact</h2>
          <p className="text-default-700">
            Questions or feedback? We&apos;d love to hear from you. This is an open-source project dedicated to food safety transparency in Chicago.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Disclaimer</h2>
          <p className="text-sm text-default-600">
            CleanPlate Chicago provides information from public health inspection records. While we strive for accuracy, we cannot guarantee the completeness or timeliness of all data. Always use your best judgment when making dining decisions.
          </p>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}

