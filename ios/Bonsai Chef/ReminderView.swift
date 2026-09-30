//
//  ReminderView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 28.06.2024.
//

import SwiftUI

struct ReminderView: View {
    @Environment(\.presentationMode) var presentationMode
    @ObservedObject var record: BonsaiRecord
    @State private var reminderMessage: String = ""
    @State private var reminderDate: Date = Date()
    
    var onSave: (String, Date) -> Void
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Messaggio")) {
                    TextField("Messaggio di promemoria", text: $reminderMessage)
                }
                
                Section(header: Text("Date ed ora")) {
                    DatePicker("Data di promemoria", selection: $reminderDate, displayedComponents: [.date, .hourAndMinute])
                }
            }
            .navigationBarTitle("Imposta promemoria", displayMode: .inline)
            .navigationBarItems(leading: Button("Annulla") {
                presentationMode.wrappedValue.dismiss()
            }, trailing: Button("Salva") {
                onSave(reminderMessage, reminderDate)
                presentationMode.wrappedValue.dismiss()
            })
        }
    }
}

