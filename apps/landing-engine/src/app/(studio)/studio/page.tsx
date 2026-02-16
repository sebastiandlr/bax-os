"use client";

import Link from "next/link";
import { BuildSpecEditor } from "./_components/BuildSpecEditor";
import { BuildSpecFormTab } from "./_components/BuildSpecFormTab";
import { BuildSpecJsonTab } from "./_components/BuildSpecJsonTab";
import { ErrorList } from "./_components/ErrorList";
import { RadiographyInputs } from "./_components/RadiographyInputs";
import { RadiographyPanel } from "./_components/RadiographyPanel";
import { useBuildSpecEditor } from "./_hooks/useBuildSpecEditor";
import { useRadiographyInputs } from "./_hooks/useRadiographyInputs";
import { useRadiographyView } from "./_hooks/useRadiographyView";

export default function StudioPage() {
  const editor = useBuildSpecEditor();
  const { radiographyInputs, seedUrls, handleRadiographyInputChange } =
    useRadiographyInputs();
  const radiography = useRadiographyView({
    validation: editor.validation,
    radiographyInputs,
    seedUrls
  });

  const leftPanel =
    editor.tab === "form" ? (
      <BuildSpecFormTab
        activeSpec={editor.activeSpec}
        onModeChange={editor.handleModeChange}
        onCapabilityToggle={editor.handleCapabilityToggle}
        onMetadataChange={editor.handleMetadataChange}
      />
    ) : (
      <BuildSpecJsonTab
        jsonText={editor.jsonText}
        onJsonChange={editor.setJsonText}
        onFormat={editor.handleJsonFormat}
      />
    );

  return (
    <section className="mx-auto max-w-6xl py-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Studio</h1>

        <Link
          href="/"
          className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm hover:bg-zinc-900"
        >
          Volver
        </Link>
      </div>

      <p className="mt-3 text-zinc-400">
        BuildSpec v0 editor with strict validation and local override persistence.
      </p>

      <BuildSpecEditor
        tab={editor.tab}
        onTabChange={editor.setTab}
        isValid={editor.isValid}
        source={editor.source}
        loading={editor.loading}
        statusMessage={editor.statusMessage}
        onLoadExample={editor.handleLoadExample}
        onLoadLocal={editor.handleLoadLocal}
        onValidate={editor.handleValidate}
        onSaveLocal={editor.handleSaveLocal}
        onResetLocal={editor.handleResetLocal}
        onExport={editor.handleExport}
        leftPanel={leftPanel}
        rightPanel={
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm">
            <div className="text-zinc-200">Validation</div>

            {editor.validation.ok ? (
              <div className="mt-3 text-zinc-300">
                <div className="text-zinc-200">
                  schemaVersion: {editor.validation.spec.schemaVersion}
                </div>
                <div className="mt-1 text-zinc-400">
                  mode: <span className="text-zinc-200">{editor.validation.spec.mode}</span>
                </div>
                <ul className="mt-2 list-disc pl-5 text-zinc-300">
                  {editor.validation.spec.capabilities.map((capability) => (
                    <li key={capability}>{capability}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <ErrorList
                errors={editor.validation.errors}
                className="mt-3 list-disc pl-5 text-rose-300"
              />
            )}

            <RadiographyInputs
              value={radiographyInputs}
              onChange={handleRadiographyInputChange}
            />
            <RadiographyPanel
              hasValidSpec={radiography.hasValidSpec}
              hasSeedUrls={radiography.hasSeedUrls}
              canRunRadiography={radiography.canRunRadiography}
              radiographyView={radiography.radiographyView}
              latestRunSummary={radiography.latestRunSummary}
              runLogWarning={radiography.runLogWarning}
              isLatestRunLogOpen={radiography.isLatestRunLogOpen}
              runLogViewerTitle={radiography.runLogViewerTitle}
              latestRunLogText={radiography.latestRunLogText}
              runLogList={radiography.runLogList}
              isRunLogListLoading={radiography.isRunLogListLoading}
              runLogListError={radiography.runLogListError}
              isRunLogPruneLoading={radiography.isRunLogPruneLoading}
              isRunLogReplayLoading={radiography.isRunLogReplayLoading}
              isRunLogDiffLoading={radiography.isRunLogDiffLoading}
              runLogOpsMessage={radiography.runLogOpsMessage}
              onExportRadiography={radiography.handleExportRadiography}
              onOpenLatestRunLog={radiography.handleOpenLatestRunLog}
              onDownloadLatestRunLog={radiography.handleDownloadLatestRunLog}
              onRefreshRunLogs={radiography.handleRefreshRunLogs}
              onOpenRunLogById={radiography.handleOpenRunLogById}
              onDownloadRunLogById={radiography.handleDownloadRunLogById}
              onPruneRunLogs={radiography.handlePruneRunLogs}
              onReplayRunLog={radiography.handleReplayRunLog}
              onComputeRunLogDiff={radiography.handleComputeRunLogDiff}
              onCloseLatestRunLog={radiography.handleCloseLatestRunLog}
            />
          </div>
        }
      />
    </section>
  );
}
