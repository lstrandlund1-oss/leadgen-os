'use client';

import { useState, FormEvent } from "react";

type Lead = {
  id: number;
  companyName: string;
  niche: string;
  location: string;
  website?: string;
  socialPresence: "low" | "medium" | "high";
  score: number;
};

export default function Home() {
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [socialPresence, setSocialPresence] = useState<"low" | "medium" | "high" | "">("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // For now, we’ll just mock some leads.
    // Later we’ll replace this with a real API call.
    const mockLeads: Lead[] = [
      {
        id: 1,
        companyName: "Example Fitness Studio",
        niche: niche || "Fitness",
        location: location || "Stockholm",
        website: "https://examplefitness.com",
        socialPresence: "low",
        score: 87,
      },
      {
        id: 2,
        companyName: "Nordic Dental Clinic",
        niche: niche || "Dental",
        location: location || "Göteborg",
        website: "https://nordicdental.se",
        socialPresence: "medium",
        score: 73,
      },
      {
        id: 3,
        companyName: "Luxe Beauty Lounge",
        niche: niche || "Beauty",
        location: location || "Malmö",
        website: "https://luxebeauty.se",
        socialPresence: "low",
        score: 91,
      },
    ];

    setLeads(mockLeads);
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">
            LeadGen OS – Lead Finder MVP
          </h1>
          <p className="text-slate-300">
            Enter basic filters and generate a list of potential business leads.
            This is your first step toward a fully automated AI lead engine.
          </p>
        </header>

        {/* Filter Form */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg space-y-6">
          <h2 className="text-xl font-semibold">Lead Filters</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  Niche / Industry
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="e.g. Real estate, tattoo studios, beauty clinics"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Stockholm, Sweden, Europe"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  Company Size (optional)
                </label>
                <input
                  type="text"
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  placeholder="e.g. 1–10, 10–50, 50–200 employees"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  Social Media Presence
                </label>
                <select
                  value={socialPresence}
                  onChange={(e) =>
                    setSocialPresence(e.target.value as "low" | "medium" | "high" | "")
                  }
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Any</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 px-4 py-2 text-sm font-semibold transition"
            >
              {isLoading ? "Generating leads..." : "Generate Leads"}
            </button>
          </form>
        </section>

        {/* Leads Table */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Results</h2>
            <p className="text-xs text-slate-400">
              Showing {leads.length} lead(s)
            </p>
          </div>

          {leads.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No leads generated yet. Fill in the filters above and click{" "}
              <span className="font-semibold text-slate-100">
                &quot;Generate Leads&quot;
              </span>{" "}
              to see results here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800">
                    <th className="text-left py-2 px-3">Company</th>
                    <th className="text-left py-2 px-3">Niche</th>
                    <th className="text-left py-2 px-3">Location</th>
                    <th className="text-left py-2 px-3">Social Presence</th>
                    <th className="text-left py-2 px-3">Score</th>
                    <th className="text-left py-2 px-3">Website</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-800 hover:bg-slate-900/70"
                    >
                      <td className="py-2 px-3 font-medium">
                        {lead.companyName}
                      </td>
                      <td className="py-2 px-3">{lead.niche}</td>
                      <td className="py-2 px-3">{lead.location}</td>
                      <td className="py-2 px-3 capitalize">
                        {lead.socialPresence}
                      </td>
                      <td className="py-2 px-3">{lead.score}</td>
                      <td className="py-2 px-3">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-400 hover:underline"
                          >
                            Visit
                          </a>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
