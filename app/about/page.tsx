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
            <li><strong>Recent Inspections (35%):</strong> Pass, Conditional, or Fail status, weighted by recency</li>
            <li><strong>Violation Severity (25%):</strong> Number and seriousness of violations found</li>
            <li><strong>Trend (15%):</strong> Is the restaurant improving or declining over time?</li>
            <li><strong>Track Record (15%):</strong> History of problems over the past 2-5 years</li>
            <li><strong>Data Freshness (10%):</strong> How recently the establishment was inspected</li>
          </ul>
          <p className="text-default-700 mb-4">
            Our algorithm is <strong>risk-adjusted</strong> — meaning we account for the fact that different types of establishments have different inspection schedules. A coffee shop (inspected every 2 years) isn&apos;t penalized the same as a restaurant (inspected every 6 months) for having an older inspection.
          </p>
          <p className="text-default-700">
            Scores are updated automatically when new inspection data is available.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Latest Inspection Badge</h2>
          <p className="text-default-700 mb-4">
            In addition to the CleanPlate Score, we show the official result from the most recent inspection. This comes directly from Chicago&apos;s health department data:
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Pass</span>
              <span className="text-default-700">Establishment met all requirements</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Conditional</span>
              <span className="text-default-700">Conditional pass - follow-up required to address issues</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Fail</span>
              <span className="text-default-700">Did not meet requirements; re-inspection required</span>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Score Ranges</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
              <span className="text-default-700"><strong>90-100:</strong> Excellent — Consistently clean, safe choice</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-lime-500"></div>
              <span className="text-default-700"><strong>70-89:</strong> Good — Generally clean, minor issues</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-amber-500"></div>
              <span className="text-default-700"><strong>50-69:</strong> Fair — Some concerns, check details</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-default-700"><strong>0-49:</strong> Poor — Significant issues, proceed with caution</span>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-default-800 mb-1">Why is my favorite restaurant&apos;s score lower than I expected?</h3>
              <p className="text-sm text-default-600">
                The score reflects health inspection data, not food quality or service. A beloved neighborhood spot might have had recent violations that affected their score.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-default-800 mb-1">How often are scores updated?</h3>
              <p className="text-sm text-default-600">
                We sync with Chicago&apos;s health department data daily. Scores update within 24 hours of new inspection results being published.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-default-800 mb-1">Can a restaurant improve their score quickly?</h3>
              <p className="text-sm text-default-600">
                Recent good inspections help immediately, but track record penalties from past problems take 2-5 years to fully fade. This prevents gaming the system.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-default-800 mb-1">Why does a restaurant show &quot;Limited Data&quot;?</h3>
              <p className="text-sm text-default-600">
                Some establishments are inspected infrequently. Until we have enough inspection history, we blend their score with similar restaurants in their category.
              </p>
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
