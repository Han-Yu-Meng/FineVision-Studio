
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SystemProvider } from './context/SystemContext';
import { Layout } from './components/Layout';
import { AgentsList } from './pages/AgentsList';
import { DataflowList } from './pages/DataflowList';
import { ParameterList } from './pages/ParameterList';
import { Editor } from './pages/Editor';
import { Performance } from './pages/Performance';
import { AgentDetails } from './pages/AgentDetails';
import { NodeLogs } from './pages/NodeLogs';
import { LLMPage } from './pages/LLM';
import { ParameterEditor } from './pages/ParameterEditor';
import { PackageHub } from './pages/PackageHub';
import { HubPackageDetail } from './pages/HubPackageDetail';
import { PackageList } from './pages/PackageList';
import { PackageDetail } from './pages/PackageDetail';
import { CreateAgent } from './pages/CreateAgent';
import { Timeline } from './pages/Timeline';

const App: React.FC = () => {
  return (
    <SystemProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/agents" replace />} />
            <Route path="/agents" element={<AgentsList />} />
            <Route path="/create-agent" element={<CreateAgent />} />
            <Route path="/dataflows" element={<DataflowList />} />
            <Route path="/parameters" element={<ParameterList />} />
            <Route path="/packages" element={<PackageList />} />
            <Route path="/hub" element={<PackageHub />} />
            <Route path="/hub/package/:id" element={<HubPackageDetail />} />
            <Route path="/package/:source/:name" element={<PackageDetail />} />
            <Route path="/agent/:id" element={<AgentDetails />} />
            <Route path="/editor" element={<Editor />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/logs/:agentId/:nodeId" element={<NodeLogs />} />
            <Route path="/llm" element={<LLMPage />} />
            <Route path="/parameter-editor" element={<ParameterEditor />} />
            <Route path="*" element={<Navigate to="/agents" replace />} />
          </Routes>
        </Layout>
      </Router>
    </SystemProvider>
  );
};

export default App;
