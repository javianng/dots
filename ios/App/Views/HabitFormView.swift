import DotsCore
import SwiftUI

/// New / Edit habit sheet (components/habit-form.tsx). New habits start
/// simple: a name field and templates; the rest appears once there's a name.
struct HabitFormView: View {
    let habit: Habit?
    @Environment(HabitStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var form: HabitForm
    @State private var confirmDelete = false
    @FocusState private var nameFocused: Bool

    init(habit: Habit?) {
        self.habit = habit
        _form = State(initialValue: HabitForm(habit?.draft ?? HabitDraft()))
    }

    private var isEdit: Bool { habit != nil }
    private var started: Bool { isEdit || !form.name.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name, e.g. Read 10 pages", text: $form.name)
                        .focused($nameFocused)
                        .submitLabel(.done)
                    if started {
                        TextField("Note (optional)", text: $form.description, axis: .vertical)
                            .lineLimit(1...4)
                    }
                }

                if !started {
                    templates
                } else {
                    goalSection
                    whenSection
                    appearanceSection
                    if let habit {
                        Section {
                            Button("Delete Habit", role: .destructive) { confirmDelete = true }
                                .frame(maxWidth: .infinity)
                        }
                        .confirmationDialog("Delete \(habit.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                            Button("Delete Habit", role: .destructive) {
                                store.delete(habit)
                                dismiss()
                            }
                        } message: {
                            Text("Its history is deleted too. This can't be undone.")
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle(isEdit ? "Edit Habit" : "New Habit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEdit ? "Done" : "Add") { save() }
                        .fontWeight(.semibold)
                        .disabled(form.problem != nil)
                }
            }
            .onAppear { if !isEdit { nameFocused = true } }
            .animation(.snappy, value: started)
        }
    }

    private func save() {
        guard form.problem == nil else { return }
        // Not awaited: Firestore applies the change on the phone at once (and
        // queues it while offline), so the sheet can close now.
        if let habit {
            store.update(habit, to: form.draft)
        } else {
            store.create(form.draft)
        }
        dismiss()
    }

    // MARK: Sections

    private var templates: some View {
        Section("Start from a template") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
                ForEach(HabitTemplates.all) { template in
                    Button {
                        Haptics.selection()
                        form = HabitForm(template.draft)
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: HabitIcons.symbol(template.draft.icon))
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.onTint)
                                .frame(width: 28, height: 28)
                                .background(Theme.tint(template.draft.colorHex), in: Squircle())
                            VStack(alignment: .leading, spacing: 0) {
                                Text(template.draft.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.ink)
                                Text(Labels.goal(template.draft)).font(.system(size: 12)).foregroundStyle(Theme.mutedText)
                            }
                            .lineLimit(1)
                            Spacer(minLength: 0)
                        }
                        .padding(8)
                        .background(Theme.ink.opacity(0.05), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(PressableStyle())
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var goalSection: some View {
        Section {
            Picker("Goal type", selection: Binding(get: { form.goalType }, set: { form.changeGoalType($0) })) {
                Text("Check off").tag(GoalType.count)
                Text("Amount").tag(GoalType.amount)
                Text("Timer").tag(GoalType.time)
                Text("Limit").tag(GoalType.limit)
            }
            .pickerStyle(.segmented)
            .listRowBackground(Theme.card)

            switch form.goalType {
            case .count:
                if form.parts.count > 1 {
                    LabeledContent("Each day", value: "Once each time")
                } else {
                    Stepper(value: $form.completionsPerDay, in: 1...Limits.maxDailyTarget) {
                        LabeledContent("Each day", value: "\(form.completionsPerDay)×")
                    }
                }
            case .time:
                Stepper {
                    LabeledContent("Duration", value: Labels.minutes(form.durationMinutes))
                } onIncrement: {
                    form.longer()
                } onDecrement: {
                    form.shorter()
                }
            case .amount, .limit:
                LabeledContent(form.goalType == .limit ? "At most" : "Daily target") {
                    HStack(spacing: 8) {
                        TextField("0", text: $form.amountTarget)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 90)
                        TextField("unit", text: $form.amountUnit)
                            .frame(maxWidth: 80)
                            .textInputAutocapitalization(.never)
                    }
                }
                LabeledContent("Each tap adds") {
                    TextField("1", text: $form.amountStep)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 90)
                }
            }

            LabeledContent("Streak goal") {
                HStack(spacing: 6) {
                    TextField("Optional", text: $form.streakGoal)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 90)
                    Text(streakUnitWord).foregroundStyle(Theme.mutedText)
                }
            }
        } header: {
            Text("Goal")
        } footer: {
            Text(form.problem ?? form.goalFooter)
        }
    }

    private var streakUnitWord: String {
        switch form.schedule.streakUnit {
        case .time: "in a row"
        case let unit: "\(unit.rawValue)s"
        }
    }

    private var whenSection: some View {
        Section {
            Picker("Repeat", selection: $form.repeatKind) {
                ForEach(HabitForm.Repeat.allCases, id: \.self) { kind in
                    Text(kind.label).tag(kind)
                }
            }

            switch form.repeatKind {
            case .days:
                ChipRow {
                    ForEach(Weekday.all) { day in
                        Chip(label: day.short, on: form.days.contains(day.value), accessibility: day.long) {
                            form.toggleDay(day.value)
                        }
                    }
                }
            case .week, .month:
                let period: Period = form.repeatKind == .week ? .week : .month
                Stepper(value: $form.times, in: 1...(Limits.maxTimes[period] ?? 6)) {
                    LabeledContent("How often", value: "\(form.times)× a \(period.rawValue)")
                }
            case .interval:
                Stepper(value: $form.every, in: 2...Limits.maxInterval) {
                    LabeledContent("Every", value: "\(form.every) days")
                }
            case .daily:
                EmptyView()
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Time of day").font(.system(size: 15))
                ChipRow {
                    ForEach(DayPart.allCases, id: \.self) { part in
                        Chip(label: part.label, on: form.parts.contains(part), accessibility: part.label) {
                            form.togglePart(part)
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        } header: {
            Text("When")
        } footer: {
            Text(form.whenFooter)
        }
    }

    private var appearanceSection: some View {
        Section("Appearance") {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 6), spacing: 8) {
                ForEach(Palette.habitColors) { pigment in
                    Button {
                        Haptics.selection()
                        form.colorHex = pigment.hex
                    } label: {
                        Circle()
                            .fill(Theme.tint(pigment.hex))
                            .frame(width: 34, height: 34)
                            .overlay {
                                if form.colorHex.caseInsensitiveCompare(pigment.hex) == .orderedSame {
                                    Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.onTint)
                                }
                            }
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel(pigment.name)
                }
            }
            .padding(.vertical, 6)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 6), spacing: 8) {
                ForEach(HabitIcons.keys, id: \.self) { key in
                    let on = form.icon == key
                    Button {
                        Haptics.selection()
                        form.icon = key
                    } label: {
                        Image(systemName: HabitIcons.symbol(key))
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(on ? Theme.onTint : Theme.ink)
                            .frame(width: 40, height: 40)
                            .background(on ? Theme.tint(form.colorHex) : Theme.ink.opacity(0.06), in: Squircle())
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("Icon \(key)")
                }
            }
            .padding(.vertical, 6)
        }
    }
}

private struct ChipRow<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: 6) { content }
            .frame(maxWidth: .infinity)
    }
}

private struct Chip: View {
    let label: String
    let on: Bool
    let accessibility: String
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.selection()
            action()
        } label: {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(on ? Theme.background : Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(on ? Theme.ink : Theme.ink.opacity(0.07), in: Capsule())
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(accessibility)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
