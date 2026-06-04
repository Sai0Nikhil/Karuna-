// =====================================================================
// KARUNA — root component.
//
// Wraps the whole app in the case-store + router providers, then renders
// the correct view based on the current hash route.
// =====================================================================

import React from 'react';
import { StoreProvider } from './store/StoreProvider';
import { RouterProvider, useRouter } from './store/router';
import { TopNav } from './components/TopNav';
import { LandingPage } from './components/LandingPage';
import { CitizenReportFlow } from './components/CitizenReportFlow';
import { NGODashboard } from './components/NGODashboard';
import { DonationsList, PerCaseDonation } from './components/DonationView';
import { AdoptionList, PerCaseAdoption } from './components/AdoptionView';
import { CaseDetail } from './components/CaseDetail';
import { StatsView } from './components/StatsView';

const RouteOutlet: React.FC = () => {
  const { route } = useRouter();
  switch (route.name) {
    case 'home':
      return <LandingPage />;
    case 'citizen':
      return <CitizenReportFlow />;
    case 'ngo':
      return <NGODashboard />;
    case 'donations':
      return route.caseId
        ? <PerCaseDonation caseId={route.caseId} />
        : <DonationsList />;
    case 'adoption':
      return route.caseId
        ? <PerCaseAdoption caseId={route.caseId} />
        : <AdoptionList />;
    case 'stats':
      return <StatsView />;
    case 'case':
      return <CaseDetail caseId={route.caseId} />;
    default:
      return <LandingPage />;
  }
};

const App: React.FC = () => (
  <StoreProvider>
    <RouterProvider>
      <div className="min-h-screen font-sans">
        <TopNav />
        <RouteOutlet />
      </div>
    </RouterProvider>
  </StoreProvider>
);

export default App;
